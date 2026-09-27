/**
 * screens/room/arena.tsx — one match on screen, for a bot duel (#/room) and a friend duel (the P2P
 * lobby hands over to it once both seats are ready). It renders whatever the room projection says:
 *
 *   scheduled (countdown)  → Countdown         quiet: useQuietRound(true), no nav, no WebGL
 *   playing, no result     → LiveQuestion      the quiet surface (live.tsx)
 *   between / last round   → RoundReceipt      stamp, receipt, XP, Surprise Audit, "Read the noting"
 *   complete / cancelled   → MatchResult       verdict text first, TARAZU 250 ms later
 *
 * Budget: toasts and ceremonies are HELD for the whole match (a label earned mid-match waits) and for
 * 1.2 s after the result renders (bible §11.12), then the shell's watcher may show them.
 * Chrome: the parent decides (#/room is 'none' by route; the P2P lobby switches to 'none' for the match).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DuelController, DuelSnapshot } from '../../use-duel';
import { useHoldToasts, useQuietRound } from '../../budget';
import { seatName } from '../../data';
import { useLang } from '../../ui/lang';
import { Skeleton } from '../../ui/skeleton';
import { Countdown, LiveQuestion, RoundHead } from './live';
import { MatchSettings, MatchSettingsButton } from './match-settings';
import { PersonalReceipt } from './personal-receipt';
export { ConfirmLeave } from './match-settings';
import { MatchResult, type Baseline, type MatchResultProps } from './result';
import { RoundReceipt } from './receipt';
import { settledRounds, type Room } from './lib';
import './arena.css';

export type ArenaView = 'loading' | 'waiting' | 'countdown' | 'live' | 'personal' | 'receipt' | 'result';

export type ArenaProps = {
  controller: DuelController;
  snapshot: DuelSnapshot | null;
  kind: 'bot' | 'friend';
  baseline: Baseline | null;
  onRematch: () => void;
  rematch?: MatchResultProps['rematch'];
  /** Leave a settled match (back to the setup). */
  onExit: () => void;
  /** The player confirmed "Leave" mid-match. */
  onLeave: () => void;
  /** A P2P connection banner (friend duels). */
  banner?: ReactNode;
  /** A local stop the room could not record (P2P: host lost, deal mismatch). */
  endReason?: string | null;
  /** Shown under the 3·2·1 (the bot's disclosure, the P2P trust line). */
  countdownNote?: ReactNode;
  /** What to show while the room is still 'waiting' (the bot readies itself at once). */
  waiting?: ReactNode;
};

export function arenaView(room: Room | null, verdictOpen: boolean, endReason?: string | null): ArenaView {
  if (!room) return 'loading';
  if (endReason) return 'result';
  const rd = room.round;
  if (room.settled) {
    const last = settledRounds(room).at(-1);
    return room.phase === 'complete' && last && !verdictOpen ? 'receipt' : 'result';
  }
  if (rd?.personalReceipt && !rd.result) return 'personal';
  if (room.phase === 'between' && rd?.result) return 'receipt';
  if ((room.phase === 'scheduled' || room.phase === 'playing') && !rd?.result)
    return rd?.question ? 'live' : 'countdown';
  if (room.phase === 'waiting') return 'waiting';
  return 'loading';
}

export function Arena({
  controller,
  snapshot,
  kind,
  baseline,
  onRematch,
  rematch,
  onExit,
  onLeave,
  banner,
  endReason,
  countdownNote,
  waiting,
}: ArenaProps) {
  const { t } = useLang();
  const room = (snapshot?.room ?? null) as Room | null;
  const [verdictFor, setVerdictFor] = useState<string | null>(null);
  const view = arenaView(room, !!room && verdictFor === room.id, endReason);
  const [asking, setAsking] = useState(false);
  const [released, setReleased] = useState(false);

  // Quiet from the countdown to round.result: nothing opens, no 3D mounts (bible §9 rule 3).
  useQuietRound(view === 'countdown' || view === 'live');
  // Held for the whole match, released 1.2 s after the result renders.
  useEffect(() => {
    if (view !== 'result') {
      setReleased(false);
      return;
    }
    const id = setTimeout(() => setReleased(true), 1200);
    return () => clearTimeout(id);
  }, [view, room?.id]);
  useHoldToasts(!released);

  // The round verdict, said once, politely (bible §7). ONE live region lives here for the whole match:
  // a region mounted with its words already in it is dropped by NVDA / JAWS, so the receipt hands its
  // sentence up and it is written into this standing region ~150 ms after the receipt mounts.
  const [said, setSaid] = useState('');
  const sayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const say = useCallback((text: string) => {
    clearTimeout(sayTimer.current);
    setSaid('');
    sayTimer.current = setTimeout(() => setSaid(text), 150);
  }, []);
  useEffect(() => () => clearTimeout(sayTimer.current), []);

  // When the view changes (not every re-render): start the new view at the top, and move focus to what
  // it is about — the receipt's verdict block ([data-autofocus]), else the view's h1 (the result's
  // verdict word, the countdown's "Get ready"). A long receipt read to its end must not leave the
  // verdict (or the next reveal) scrolled out of sight.
  const lastView = useRef<string>('');
  useEffect(() => {
    const key = `${view}:${room?.round?.id ?? ''}`;
    if (lastView.current === key) return;
    lastView.current = key;
    if (view !== 'receipt' && view !== 'personal') {
      clearTimeout(sayTimer.current);
      // Not as a live round mounts: nothing may re-render the arena around the reveal marker.
      if (view !== 'live') setSaid('');
    }
    // The live card focuses its own stem at the reveal marker (live.tsx), so a screen reader hears the
    // question as the clock starts; nothing here may touch the page during a live round.
    if (view === 'live' || view === 'loading') return;
    window.scrollTo(0, 0); // the edition sets no smooth scrolling, so this jumps (no motion)
    const h =
      document.querySelector<HTMLElement>('.h-arena [data-autofocus]') ??
      document.querySelector<HTMLElement>('.h-arena h1');
    if (h) {
      if (!h.hasAttribute('tabindex')) h.tabIndex = -1;
      // Never pull focus out of the open "Leave the room?" dialog.
      if (!document.querySelector('.h-arena dialog[open]')) h.focus({ preventScroll: true });
    }
  }, [view, room?.round?.id]);

  if (!room || view === 'loading')
    return (
      <div className="h-arena h-arena--pad">
        <div className="h-matchsettings-toolbar"><MatchSettingsButton onClick={() => setAsking(true)} /></div>
        {asking ? <MatchSettings onClose={() => setAsking(false)} onQuit={onLeave} running={false} /> : null}
        <Skeleton lines={4} label={t('Opening the file…', 'फ़ाइल खुल रही है…')} />
      </div>
    );

  const names: [string, string] = [seatName(room.players[0]), seatName(room.players[1])];
  const ask = () => setAsking(true);

  let body: ReactNode = null;
  if (view === 'waiting')
    body = <><RoundHead room={room} names={names} onSettings={ask} />{waiting ?? <Skeleton lines={3} label={t('Opening the file…', 'फ़ाइल खुल रही है…')} />}</>;
  else if (view === 'countdown')
    body = <><RoundHead room={room} names={names} onSettings={ask} /><Countdown room={room} snapshot={snapshot!} names={names} note={countdownNote} /></>;
  else if (view === 'live')
    body = (
      <LiveQuestion
        key={room.round!.id}
        controller={controller}
        snapshot={snapshot!}
        room={room}
        names={names}
        kind={kind}
        onSettings={ask}
        banner={banner}
        paused={asking}
      />
    );
  else if (view === 'personal')
    body = <PersonalReceipt key={room.round!.id} room={room} names={names} onSettings={ask} banner={banner} onSay={say} />;
  else if (view === 'receipt') {
    const round = settledRounds(room).at(-1)!;
    const final = room.settled;
    body = (
      <RoundReceipt
        key={round.id}
        room={room}
        round={round}
        names={names}
        kind={kind}
        final={final}
        busy={!!snapshot?.busy}
        banner={banner}
        onSettings={ask}
        onSay={say}
        onNext={() => {
          if (final) setVerdictFor(room.id);
          else void controller.ready().catch(() => {});
        }}
      />
    );
  } else if (view === 'result')
    body = (
      <MatchResult
        key={room.id}
        room={room}
        names={names}
        kind={kind}
        baseline={baseline}
        onRematch={onRematch}
        rematch={rematch}
        onExit={onExit}
        onSettings={ask}
        endReason={endReason}
      />
    );

  return (
    <div className="h-arena" data-view={view}>
      {body}
      <p className="h-sr" aria-live="polite">
        {said}
      </p>
      {snapshot?.error && view !== 'live' && view !== 'result' ? (
        <p className="h-arena__error" role="alert">
          {snapshot.error}
        </p>
      ) : null}
      {asking ? (
        <MatchSettings
          onClose={() => setAsking(false)}
          onQuit={room.settled || endReason ? onExit : onLeave}
          running={view === 'live' || view === 'countdown' || view === 'personal'}
          settled={room.settled || !!endReason}
          resultReady={view === 'receipt' || view === 'result'}
        />
      ) : null}
    </div>
  );
}
