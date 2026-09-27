/**
 * screens/room/live.tsx — the LIVE question (bible §11.10, ENGINE §6.3 timing contract) and what
 * frames it: the round header and the typed 3·2·1.
 *
 * The quiet surface, as a checklist:
 *  - the card mounts `visibility:hidden` and becomes visible in the same animation frame in which
 *    `useQuestionShown` calls `markShown()` (two frames after mount), so the clock starts with the
 *    paint that shows the question — no entrance animation, no layout shift, no work before it;
 *  - the options are rendered exactly as the engine dealt them; no correctness styling (the key is not
 *    even in the projection until `round.result`);
 *  - the timer is a 6px ink bar directly above the answers, written from requestAnimationFrame with
 *    `transition: none` — never red, never shaking; screen readers hear it only at 5 s and 2 s;
 *  - press / lock feedback and the `select` cue are the only feedback. No toasts, stamps, tape, 3D or
 *    share buttons (the arena holds the budget quiet from the countdown to the result).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Lock, X } from 'lucide-react';
import { useJuice } from '@/components/fx';
import { useQuestionShown, type DuelController, type DuelSnapshot } from '../../use-duel';
import { IconButton } from '../../ui/button';
import { useLang } from '../../ui/lang';
import { OptionList } from '../../ui/option';
import { formatNameHi, formatOf, roundOf, sectorName } from '../duel/lib';
import { other, type Room } from './lib';
import './live.css';
import '../../ui/stopwatch.css';

// ---- the round header (replaces the top bar in a room) -------------------------------------------------

export type RoundHeadProps = {
  room: Room;
  names: readonly [string, string];
  onLeave?: () => void;
  leaveLabel?: string;
  /** Override the round line (the result screen says "Final"). */
  sub?: ReactNode;
};

export function RoundHead({ room, names, onLeave, leaveLabel, sub }: RoundHeadProps) {
  const { t, isHi } = useLang();
  const f = formatOf(room.config.mode);
  const me = room.seat;
  const them = other(me);
  const mine = room.scores[me] ?? 0;
  const theirs = room.scores[them] ?? 0;
  return (
    // With no × (the match result, the last round's receipt) the score sits at the right gutter, not 8px.
    <header className={onLeave ? 'h-roundhead' : 'h-roundhead h-roundhead--noleave'}>
      <div className="h-roundhead__ids">
        <p className="h-roundhead__fmt">{isHi ? <span lang="hi">{formatNameHi(f.mode)}</span> : f.name}</p>
        <p className="h-roundhead__round">{sub ?? roundOf(f.mode, room.roundIndex, isHi)}</p>
      </div>
      <p className="h-roundhead__score">
        {/* A paragraph cannot carry an aria-label (naming is prohibited on its role): the words go in
            (bible §7: "Score: you 1, Babu-Bot · BOT 0"). */}
        <span className="h-sr">
          {t(`Score: you ${mine}, ${names[them]} ${theirs}`, `स्कोर: आप ${mine}, ${names[them]} ${theirs}`)}
        </span>
        <span className="h-roundhead__pill" aria-hidden="true">
          <span className="h-mono">{mine}</span>
          <span className="h-roundhead__dash">–</span>
          <span className="h-mono">{theirs}</span>
        </span>
        <span className="h-roundhead__who" aria-hidden="true">
          {t('You', 'आप')} · {names[them]}
        </span>
      </p>
      {onLeave ? (
        <IconButton
          label={leaveLabel ?? t('Leave the room', 'रूम छोड़ें')}
          icon={<X size={22} strokeWidth={2.6} />}
          onClick={onLeave}
          className="h-roundhead__leave"
        />
      ) : null}
    </header>
  );
}

// ---- 3 · 2 · 1 --------------------------------------------------------------------------------------------

export function Countdown({
  room,
  snapshot,
  names,
  note,
}: {
  room: Room;
  snapshot: DuelSnapshot;
  names: readonly [string, string];
  note?: ReactNode;
}) {
  const { t, isHi } = useLang();
  const ms = snapshot.countdownMs ?? 0;
  const n = Math.max(1, Math.ceil(ms / 1000));
  const f = formatOf(room.config.mode);
  const said = useRef(false);
  const [line, setLine] = useState('');
  // One polite announcement per round, not one per numeral.
  useEffect(() => {
    if (said.current) return;
    said.current = true;
    setLine(
      t(
        `${roundOf(f.mode, room.roundIndex)} starts in ${n} seconds.`,
        `${roundOf(f.mode, room.roundIndex, true)} ${n} सेकंड में।`,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const them = other(room.seat);
  return (
    <section className="h-count" aria-labelledby="h-count-title">
      <h1 className="h-sr" id="h-count-title">
        {t('Get ready', 'तैयार हो जाइए')}
      </h1>
      <p className="h-count__num h-mono" aria-hidden="true">
        {n}
      </p>
      <p className="h-count__vs">
        {t('You', 'आप')} <span className="h-count__v">vs</span> {names[them]}
      </p>
      <p className="h-count__meta">
        {isHi ? <span lang="hi">{formatNameHi(f.mode)}</span> : f.name} ·{' '}
        {t(`${f.duration} s a question`, `हर सवाल ${f.duration} s`)}
        {room.config.topic && room.config.topic !== 'all' ? ` · ${sectorName(room.config.topic, isHi)}` : ''}
      </p>
      {note ? <div className="h-count__note">{note}</div> : null}
      <p className="h-sr" aria-live="polite">
        {line}
      </p>
    </section>
  );
}

// ---- the question ------------------------------------------------------------------------------------------

export type LiveQuestionProps = {
  controller: DuelController;
  snapshot: DuelSnapshot;
  room: Room;
  names: readonly [string, string];
  kind: 'bot' | 'friend';
  onLeave: () => void;
  /** A P2P connection banner (friend duels only). */
  banner?: ReactNode;
  /** The "Leave the room?" dialog is open: no taps or keys reach the answers behind it. */
  paused?: boolean;
};

/** Keyed by the round id by its parent, so the local pick resets each round. */
export function LiveQuestion({
  controller,
  snapshot,
  room,
  names,
  kind,
  onLeave,
  banner,
  paused = false,
}: LiveQuestionProps) {
  const { t, isHi } = useLang();
  const juice = useJuice();
  // ENGINE §6.3: the clock starts two animation frames after the question mounts.
  useQuestionShown(controller, snapshot);
  const rd = room.round!;
  const q = rd.question!;
  const card = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const stopwatch = useRef<HTMLOutputElement>(null);
  const said = useRef<HTMLParagraphElement>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const shown = snapshot.shownRoundId === rd.id;
  const them = other(room.seat);

  // The reveal marker: flip visibility in the same frame as markShown() (registered after it, so it
  // runs right after it in that frame's rAF phase, before the paint). In that same step focus moves to
  // the stem, so a screen reader reads the question as the clock starts (it would otherwise hear
  // nothing until "5 seconds left") and the 1–4 / A–D keys work at once (they need focus inside the
  // card). It is a quiet move: no scroll, no ring (live.css), and nothing before the marker.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const reveal = () => {
      el.dataset.shown = '';
      // Never pull focus out of an open dialog ("Leave the room?") or a field.
      const active = document.activeElement;
      if (active && active !== document.body && active.closest('dialog[open], input, textarea, select'))
        return;
      document.getElementById(`h-live-stem-${rd.id}`)?.focus({ preventScroll: true });
    };
    if (controller.snapshot().shownRoundId === rd.id) {
      reveal();
      return;
    }
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(reveal);
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [controller, rd.id]);

  // The timer: continuous, from rAF, written straight to the bar (no re-render per frame).
  useEffect(() => {
    const total = room.config.duration * 1000;
    let raf = 0;
    let at5 = total <= 5000;
    let at2 = false;
    const step = () => {
      const snap = controller.snapshot();
      const started = snap.shownRoundId === rd.id;
      const left = started ? (snap.remainingMs ?? 0) : total;
      if (stopwatch.current) stopwatch.current.textContent = `${(Math.floor((snap.elapsedMs ?? 0) / 100) / 10).toFixed(1)} s`;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
      if (started && said.current) {
        if (!at5 && left <= 5000) {
          at5 = true;
          said.current.textContent = isHi ? '5 सेकंड बाकी' : '5 seconds left';
        }
        if (!at2 && left <= 2000) {
          at2 = true;
          said.current.textContent = isHi ? '2 सेकंड बाकी' : '2 seconds left';
        }
      }
      if (!started || left > 0) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [controller, rd.id, room.config.duration, isHi]);

  const locked = chosen !== null || snapshot.locked;
  const choose = (i: number) => {
    if (locked || !shown) return;
    setChosen(i);
    juice.sound('select');
    juice.haptic('light');
    void controller.answer(i).then((ok: boolean) => {
      if (!ok && !controller.snapshot().locked) setChosen(null);
    });
  };

  const theirLock = !!rd.answerLocked?.[them];
  const status = !locked
    ? null
    : kind === 'friend' && !theirLock
      ? t(`Locked · waiting for ${names[them]}`, `लॉक · ${names[them]} का इंतज़ार`)
      : t('Locked · waiting for the clock', 'लॉक · घड़ी का इंतज़ार');
  const kicker =
    q.topic && !q.options.some((o) => o.toLowerCase().includes(q.topic.toLowerCase()))
      ? sectorName(q.topic, isHi)
      : null;

  return (
    <div className="h-live">
      <RoundHead room={room} names={names} onLeave={onLeave} />
      {/* A P2P drop mid-question ('Connection lost — waiting 10 s') lays over the round header instead of
          pushing the stem and options down under a tapping thumb (bible §11.10: no layout shift). */}
      {banner ? <div className="h-live__banner">{banner}</div> : null}
      <section ref={card} className="h-live__card" aria-labelledby={`h-live-stem-${rd.id}`}>
        <div className="h-live__top">
          {kicker ? <p className="h-live__kicker">{kicker}</p> : null}
          <h1 className="h-live__stem" id={`h-live-stem-${rd.id}`} lang="en" tabIndex={-1}>
            {q.question}
          </h1>
        </div>
        <div className="h-live__bottom">
          <div className="h-stopwatch">
            <span className="h-stopwatch__label">{t('STOPWATCH', 'स्टॉपवॉच')}</span>
            <output ref={stopwatch} className="h-stopwatch__time" aria-live="off" aria-label={t('Elapsed answer time', 'जवाब का समय')}>0.0 s</output>
            <span className="h-stopwatch__bands">{t('Correct: <8s 30 XP · <15s 20 XP · 15s+ 10 XP', 'सही: <8s 30 XP · <15s 20 XP · 15s+ 10 XP')}</span>
          </div>
          <div className="h-live__timer" aria-hidden="true">
            <div className="h-live__bar" ref={bar} />
          </div>
          <OptionList
            options={q.options}
            chosen={chosen ?? null}
            correctIndex={null}
            onChoose={locked || !shown || paused ? undefined : choose}
            disabled={locked || !shown || paused}
            keys={!locked && shown && !paused}
            label={t('Answers', 'जवाब')}
            className="h-live__opts"
          />
          <p className="h-live__status" role="status">
            {status ? (
              <>
                <Lock aria-hidden="true" size={16} strokeWidth={2.6} />
                <span>{status}</span>
              </>
            ) : (
              <span className="h-live__keys">
                {t('First tap locks.', 'पहला टैप लॉक।')}
                <span className="h-live__keyhint"> {t('Keys 1–4 or A–D.', 'की 1–4 या A–D।')}</span>
              </span>
            )}
          </p>
          {snapshot.error && locked ? (
            <p className="h-live__error" role="alert">
              <span>{snapshot.error}</span>
              <button type="button" className="h-link h-link--tap" onClick={() => void controller.resend()}>
                {t('Send again', 'फिर भेजें')}
              </button>
            </p>
          ) : null}
        </div>
        <p className="h-sr" aria-live="polite" ref={said} />
      </section>
    </div>
  );
}
