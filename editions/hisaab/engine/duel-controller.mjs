/**
 * editions/hisaab/engine/duel-controller.mjs — one match, driven through any `request()`.
 *
 * app/arena.tsx drives a duel inline in React state. This is the same protocol as a plain object a
 * screen can hold, so the edition's screens do not have to re-derive it:
 *
 *   clock calibration → create (+ ready, for a bot) → poll `state` (500 ms live, 1500 ms waiting) →
 *   reveal at the shared countdown → the screen paints the question and calls `markShown()` → the
 *   player picks → `answer(choice)` sends the reveal-to-input duration → poll to the verdict.
 *
 * `request` is anything with lib/duel-client's contract: `request(body) → Promise<result>` or a thrown
 * Error with `.code` / `.status`. That is `request` from '@/lib/duel-client' (in this edition's build,
 * the in-process duel service) for a bot duel, or a P2P session's `request` (p2p/protocol.mjs) for a
 * friend duel — which already carries its own seat token, so it is attached with `adopt(room)`.
 *
 * Timing contract (README "Timing contract"): the elapsed time is measured from `markShown()` —
 * call it only once the question is actually on screen (after a double requestAnimationFrame, as the
 * arena does) — to the pick, on the monotonic clock. Nothing else is measured.
 *
 * Framework-free: `onChange(snapshot)` fires on every change; React code wraps it in a hook. While
 * a round waits for its reveal, a 150 ms ticker re-renders the 3·2·1 (`countdownMs`); once the question
 * is out it stays silent, because the timer bar reads `snapshot()` from its own rAF loop — a re-render
 * of the live card several times a second buys nothing (bible §11.10: no work on the quiet surface).
 *
 * Epochs: `adopt()`, `reset()` and `createBot()` start a new epoch. Every response is checked against
 * the epoch it was sent in AFTER its await, so a reply that lands late (a poll on the wire, a P2P poke,
 * a ready/answer/leave) can neither bring back a forgotten match nor replace a newly adopted room.
 */

const hexToken = () =>
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
const roomIdOf = () => globalThis.crypto.randomUUID().replaceAll('-', '');

/**
 * @param {object} options
 * @param {(body: any) => Promise<any>} options.request
 * @param {(snapshot: any) => void} [options.onChange]
 * @param {() => number} [options.perfNow] monotonic clock (default performance.now)
 * @param {{ active: number, waiting: number, hidden: number }} [options.pollMs]
 */
export function createDuelController({
  request,
  onChange = () => {},
  perfNow = () => globalThis.performance.now(),
  pollMs = { active: 500, waiting: 1500, hidden: 3000 },
} = {}) {
  let room = null,
    credentials = null,
    error = '',
    busy = false,
    clock = { rttMs: 0, jitterMs: 0, offset: 0, samples: 0 },
    startMark = null,
    pending = null,
    locked = false,
    revealing = false,
    pollTimer = null,
    tickTimer = null,
    disposed = false,
    epoch = 0;

  const snapshot = () => ({
    room,
    error,
    busy,
    clock,
    shownRoundId: startMark?.roundId ?? null,
    locked,
    countdownMs: countdownMs(),
    remainingMs: remainingMs(),
    elapsedMs: startMark ? (pending?.roundId === startMark.roundId ? pending.elapsedMs : Math.max(0, perfNow() - startMark.at)) : null,
  });
  const changed = () => {
    if (!disposed) onChange(snapshot());
  };
  const withSeat = (body) => (credentials ? { ...body, ...credentials } : body);

  function countdownMs() {
    const rd = room?.round;
    if (!rd || !['scheduled', 'playing'].includes(room.phase)) return null;
    return Math.max(0, rd.scheduledAt - (perfNow() + clock.offset));
  }
  function remainingMs() {
    const rd = room?.round;
    if (!rd || !startMark || startMark.roundId !== rd.id || rd.result) return null;
    const elapsedMs = pending?.roundId === rd.id ? pending.elapsedMs : perfNow() - startMark.at;
    return Math.max(0, room.config.duration * 1000 - elapsedMs);
  }

  /**
   * Newer revisions only: a slow poll landing after a fresh answer must not rewind the screen. `mine`
   * is the epoch the request was sent in; a reply from an earlier epoch (before `reset()` / `adopt()` /
   * `createBot()`) is dropped whatever its room id or revision.
   */
  function accept(data, mine = epoch) {
    if (mine !== epoch) return;
    const next = data?.room;
    if (!next) return;
    if (room && next.id === room.id && next.revision < room.revision) return;
    const newRound = next.round?.id !== room?.round?.id;
    room = next;
    if (newRound) {
      startMark = null;
      pending = null;
      locked = false;
    }
    if (room.round?.result) locked = true;
    schedule();
    changed();
  }

  function schedule() {
    clearTimeout(pollTimer);
    pollTimer = null;
    const live = !disposed && !!room && !room.settled && ['scheduled', 'playing'].includes(room.phase);
    // The 150 ms ticker runs for as long as a round is live and is never restarted by a poll: a poll
    // interval shorter than the tick would otherwise reset it before it ever fired.
    if (live && tickTimer === null) tickTimer = setInterval(tick, 150);
    if (!live && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    if (disposed || !room || room.settled) return;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const mine = epoch;
    pollTimer = setTimeout(() => void poll(mine), hidden ? pollMs.hidden : live ? pollMs.active : pollMs.waiting);
  }

  async function poll(mine) {
    if (disposed || mine !== epoch) return;
    try {
      accept(await request(withSeat({ action: 'state' })), mine);
    } catch (e) {
      // A failure from an earlier epoch is not this match's error, and must not start a second poll loop.
      if (mine !== epoch) return;
      error = e?.message || 'Connection interrupted.';
      changed();
      if ([403, 404, 410].includes(e?.status)) return;
      schedule();
    }
  }

  /**
   * Reveal once the shared countdown has run out, and re-render the countdown meanwhile. Once the
   * question is out (or the round has its result) the tick changes nothing a re-render would show, so
   * it stays silent: the live card's timer bar reads `snapshot()` from rAF.
   */
  async function tick() {
    const rd = room?.round;
    if (!rd || revealing || disposed) return;
    const waiting = rd.issuedAt === null && !rd.result;
    if (!waiting) return;
    if (countdownMs() === 0) {
      revealing = true;
      const mine = epoch;
      try {
        accept(await request(withSeat({ action: 'reveal', roundId: rd.id })), mine);
      } catch (e) {
        if (mine === epoch && e?.code !== 'too_early') {
          error = e?.message || 'Could not open the question.';
          changed();
        }
      } finally {
        revealing = false;
      }
    } else changed();
  }

  async function run(fn) {
    const mine = epoch;
    busy = true;
    error = '';
    changed();
    try {
      return await fn();
    } catch (e) {
      if (mine === epoch) error = e?.message || 'Something went wrong.';
      throw e;
    } finally {
      busy = false;
      changed();
    }
  }

  const controller = {
    get room() {
      return room;
    },
    get error() {
      return error;
    },
    get credentials() {
      return credentials;
    },
    snapshot,
    /** Seven `clock` probes; the fastest gives the offset, the spread the jitter (as the arena does). */
    async calibrate(samples = 7) {
      const out = [];
      for (let i = 0; i < samples; i++) {
        const before = perfNow();
        const data = await request({ action: 'clock' });
        const after = perfNow();
        out.push({ rtt: after - before, offset: data.serverNow - (before + after) / 2 });
      }
      const sorted = out.sort((a, b) => a.rtt - b.rtt);
      clock = {
        rttMs: Math.round(sorted[0].rtt),
        jitterMs: Math.round(sorted.at(-1).rtt - sorted[0].rtt),
        offset: sorted[0].offset,
        samples: out.length,
      };
      changed();
      return clock;
    },
    /**
     * A free match against the labelled practice bot. `config` needs `mode` and `duration` (see
     * lib/server/room-engine.mjs MODE_DURATION); filters default to 'all'. `profileEpoch` is echoed on
     * the credentials so the caller can hand it to `usePlayer(room, epoch)`.
     */
    async createBot({ name, config, profileEpoch = null }) {
      // A new match: replies still on the wire for the previous one are dropped from here on.
      epoch += 1;
      const mine = epoch;
      return run(async () => {
        if (!clock.samples) await controller.calibrate(3);
        if (mine !== epoch) return room;
        const draft = {
          roomId: roomIdOf(),
          token: hexToken(),
          invite: hexToken(),
          name,
          config: {
            domain: 'all',
            region: 'all',
            topic: 'all',
            subtopic: 'all',
            difficulty: 'all',
            stake: 0,
            ...config,
            opponent: 'bot',
          },
        };
        const created = await request({ action: 'create', ...draft });
        // reset() / adopt() while the room was being created: leave the newer state alone.
        if (mine !== epoch) return room;
        credentials = { roomId: draft.roomId, token: draft.token };
        controller.profileEpoch = profileEpoch;
        accept(created, mine);
        if (created.room.phase === 'waiting')
          accept(
            await request(
              withSeat({ action: 'ready', roundId: null, rttMs: clock.rttMs, jitterMs: clock.jitterMs }),
            ),
            mine,
          );
        return room;
      });
    },
    /** Take over a room whose `request` already carries its seat (a P2P host or guest session). */
    adopt(data, seat = null) {
      epoch += 1;
      credentials = seat;
      room = null;
      accept(data);
      return room;
    },
    /** Ready for the next round (a friend room; a bot room readies the human seat by itself). */
    async ready() {
      const mine = epoch;
      return run(async () => {
        accept(
          await request(
            withSeat({
              action: 'ready',
              roundId: room?.round?.id ?? null,
              rttMs: clock.rttMs,
              jitterMs: clock.jitterMs,
            }),
          ),
          mine,
        );
        return room;
      });
    },
    /** Poll now (e.g. on a P2P session's poke). */
    refresh() {
      return poll(epoch);
    },
    /** The question is painted: start the reveal-to-input clock. Idempotent per round. */
    markShown() {
      const rd = room?.round;
      if (!rd?.question || rd.result || startMark?.roundId === rd.id) return;
      startMark = { roundId: rd.id, at: perfNow() };
      changed();
    },
    /** Lock an answer (0–3). Ignored before `markShown()`, after the clock, or once locked. */
    async answer(choice) {
      const rd = room?.round;
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) return false;
      if (!rd || rd.result || locked || !startMark || startMark.roundId !== rd.id) return false;
      if (rd.answerLocked?.[room.seat]) return false;
      const elapsedMs = perfNow() - startMark.at;
      if (elapsedMs >= room.config.duration * 1000) return false;
      locked = true;
      const attemptId = hexToken();
      pending = { roundId: rd.id, attemptId, choice, elapsedMs };
      changed();
      return controller.resend();
    },
    /** Re-send the locked answer unchanged (same attempt id), e.g. after a dropped connection. */
    async resend() {
      if (!pending) return false;
      const mine = epoch;
      try {
        accept(await request(withSeat({ action: 'answer', ...pending })), mine);
        return mine === epoch;
      } catch (e) {
        if (mine !== epoch) return false;
        error =
          e?.status === 409 ? e.message : 'Your choice is locked on this screen. Retry sending the same answer.';
        changed();
        return false;
      }
    },
    async leave() {
      if (!room) return;
      const mine = epoch;
      return run(async () => {
        accept(await request(withSeat({ action: 'leave' })), mine);
      });
    },
    /** Forget the match (after a result, or to start another). */
    reset() {
      epoch += 1;
      clearTimeout(pollTimer);
      clearInterval(tickTimer);
      pollTimer = tickTimer = null;
      room = credentials = startMark = pending = null;
      locked = false;
      error = '';
      changed();
    },
    /** Undo `dispose()` (React StrictMode unmounts and remounts effects once in development). */
    resume() {
      disposed = false;
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(pollTimer);
      clearInterval(tickTimer);
      pollTimer = tickTimer = null;
    },
  };
  return controller;
}
