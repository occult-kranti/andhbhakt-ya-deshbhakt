/**
 * screens/route/card.tsx — the untimed card, shared by the route player, Aaj Ka Hisaab and the
 * taster (bible §11.7).
 *
 *   <PlayHeader …/>      the manila file strip: F.No. · n of N, the segment bar, × (saves and exits),
 *                        and on the first card of a sealed file the red tape that snaps on the lock
 *   <QuestionCard …/>    kicker (sector · state · year, spoiler-safe) → stem → stopwatch →
 *                        four h-opt → "No deadline. First answer locks." A forwarded
 *                        claim (item kind 'forward', bible §11.6) sits in a paper chat bubble tagged
 *                        "↪ Forwarded many times" above its question.
 *   <CardResult …/>      after the lock only: stamp → receipt (prints) → noting → Open source / Forward
 *   <PlayBar …/>         the sticky Next action (the screen's one violet primary once a card is locked)
 *
 * Quiet by rule (bible §11.7, ENGINE §6.3 spirit): nothing animates on a card before the answer locks
 * — no entrance, no tape, no stamp, no toast (the screens hold toasts while a card is up). Fixed option
 * order: the engine's deal is rendered as dealt.
 */
import { forwardRef, useEffect, useLayoutEffect, useMemo, useId, useRef, type ReactNode } from 'react';
import { CornerUpRight, ExternalLink, Forward, Scale, X } from 'lucide-react';
import { useJuice } from '@/components/fx';
import type { Card } from '../../../edition';
import { itemForCard, type BankItem } from '../../data';
import { shareReceipt, SHARE_CTA, type ReceiptShareVariant } from '../../share';
import { Button, IconButton } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { Stopwatch } from '../../ui/stopwatch';
import { createStopwatch } from '../../../engine/scoring.mjs';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { NotingSheet } from '../../ui/noting-sheet';
import { OptionList } from '../../ui/option';
import { Receipt } from '../../ui/receipt';
import { Stamp } from '../../ui/stamp';
import { Tape } from '../../ui/tape';
import { Kicker } from '../../ui/text';
import { otherSideOf, shareWords, signed, useShareState, type XpLine } from './lib';
import './card.css';

// ---- the file strip ---------------------------------------------------------------------------------

const DEVANAGARI = /[\u0900-\u097F]/;

export type SegmentState = 'done' | 'current' | 'todo';

export type PlayHeaderProps = {
  fno: string;
  title: string;
  titleHi?: string;
  /** 0-based index of the card on screen. */
  index: number;
  total: number;
  /** One state per card. */
  segments: readonly SegmentState[];
  /** A chapter or sub-line ('The follow-up'). */
  sub?: ReactNode;
  /** Run score so far (routes). */
  score?: number | null;
  /** Red tape across the strip: 'idle' before the first lock of a sealed file, 'snapping' on it. */
  tape?: 'idle' | 'snapping' | null;
  onTapeSnapped?: () => void;
  /** "Tape cut. 1 of 6." once the tape has gone. */
  note?: string | null;
  closeHref: string;
  closeLabel: string;
  onClose?: () => void;
};

export function PlayHeader({
  fno,
  title,
  titleHi,
  index,
  total,
  segments,
  sub,
  score,
  tape,
  onTapeSnapped,
  note,
  closeHref,
  closeLabel,
  onClose,
}: PlayHeaderProps) {
  const { t, isHi } = useLang();
  const done = segments.filter((s) => s === 'done').length;
  return (
    <header className={cx('h-playhead', tape && 'h-playhead--taped')}>
      <div className="h-playhead__row">
        <div className="h-playhead__ids">
          <Kicker className="h-playhead__fno">
            <span>{fno}</span>
            <span aria-hidden="true"> · </span>
            <span className="h-tnum">{isHi ? `${index + 1}/${total}` : `${index + 1} of ${total}`}</span>
          </Kicker>
          <h1 className="h-playhead__title">
            {titleHi ? (
              <span className="h-playhead__titlehi" lang="hi">
                {titleHi}
              </span>
            ) : null}
            <span className="h-playhead__titleen" lang={DEVANAGARI.test(title) ? 'hi' : 'en'}>
              {title}
            </span>
          </h1>
          {sub ? <p className="h-playhead__sub">{sub}</p> : null}
        </div>
        <div className="h-playhead__side">
          {typeof score === 'number' ? (
            <p className="h-playhead__score">
              <span className="h-mono">{signed(score)}</span>
              <span className="h-playhead__pts">{t('right', 'सही')}</span>
            </p>
          ) : null}
          {onClose ? (
            <IconButton label={closeLabel} icon={<X size={22} strokeWidth={2.6} />} onClick={onClose} className="h-playhead__close" />
          ) : (
            <IconButton label={closeLabel} icon={<X size={22} strokeWidth={2.6} />} href={closeHref} className="h-playhead__close" />
          )}
        </div>
      </div>
      <ol className="h-playhead__segs" aria-hidden="true">
        {segments.map((s, i) => (
          <li key={i} className={cx('h-playhead__seg', `h-playhead__seg--${s}`)} />
        ))}
      </ol>
      <p className="h-sr">
        {t(`Card ${index + 1} of ${total}. ${done} answered.`, `कार्ड ${index + 1}/${total}। ${done} जवाब दिए।`)}
      </p>
      {tape ? (
        <div className="h-playhead__tape">
          <Tape state={tape} onSnapped={onTapeSnapped} />
        </div>
      ) : null}
      {tape === 'idle' ? <p className="h-sr">{t('Sealed. The tape is cut on your first answer.', 'सील। पहले जवाब पर फ़ीता कटेगा।')}</p> : null}
      {note ? (
        <p className="h-playhead__note" role="status">
          {note}
        </p>
      ) : null}
    </header>
  );
}

// ---- the question ------------------------------------------------------------------------------------

const QUESTION_TAIL = /(?:^|[.!?'’"”)]\s+)((?:What|Which|How|Who|Whom|Where|When|Why|Per|According|Is|Was|Did|Does)\b[^]*)$/;

/**
 * A Forward Court stem split into the claim on trial and the question put to it ("Viral forward, Nov
 * 2016: '…GPS nano-chip…'" | "What did the RBI say?"). The same cut as the files docket's claimOf
 * (screens/files/lib.ts), kept here so the play card does not import another lane's screen. Question
 * text only, so the claim never holds the ruling. With no separate question sentence the whole stem is
 * the claim.
 */
function splitClaim(stem: string): { claim: string; ask: string | null } {
  const s = stem.trim();
  const m = QUESTION_TAIL.exec(s);
  if (!m || m.index === 0) return { claim: s, ask: null };
  const cut = m.index + (m[0].length - m[1].length);
  const claim = s.slice(0, cut).trim();
  return claim.length >= 24 ? { claim, ask: s.slice(cut).trim() } : { claim: s, ask: null };
}

/**
 * The stem of a forwarded claim (bible §11.6): the claim in a generic paper chat bubble tagged
 * "↪ Forwarded many times" (never a messenger's green, ticks or chrome) with the neutral "Claim on
 * trial" chip, so the claim never reads as our own words; the question sits under it as the stem.
 * Static: nothing here moves before or after the lock.
 */
function ForwardStem({ id, question, locked }: { id: string; question: string; locked: boolean }) {
  const { isHi } = useLang();
  const { claim, ask } = splitClaim(question);
  // Two unbreakable halves, so a narrow bubble wraps the chip at its "·" and nowhere else.
  const [a, b] = isHi
    ? ['दावा ·', locked ? 'फ़ैसला रसीद पर' : 'फ़ैसला बंद']
    : ['Claim on trial ·', locked ? 'ruling on the receipt' : 'ruling sealed'];
  return (
    <h2 className="h-qcard__stem h-qcard__stem--fwd" id={id} lang="en" tabIndex={-1}>
      <span className="h-qcard__bubble">
        <span className="h-qcard__bubblehead">
          <span className="h-qcard__fwd">
            <CornerUpRight size={14} strokeWidth={2.6} aria-hidden="true" />
            Forwarded many times
          </span>
          <span className="h-sr">. </span>
          <Chip kind="legal" icon={<Scale size={12} strokeWidth={2.6} />} lang={isHi ? 'hi' : 'en'} className="h-qcard__trial">
            <span className="h-qcard__trialpart">{a}</span> <span className="h-qcard__trialpart">{b}</span>
          </Chip>
          <span className="h-sr">. </span>
        </span>
        <span className="h-qcard__claim">{claim}</span>
      </span>
      {ask ? (
        <>
          <span className="h-sr"> </span>
          <span className="h-qcard__ask">{ask}</span>
        </>
      ) : null}
    </h2>
  );
}

export type QuestionCardProps = {
  /** `factId` (every dealt Card has one) finds the bank item, so a forwarded claim gets its bubble. */
  card: Pick<Card, 'question' | 'options' | 'correctIndex' | 'topic'> & { factId?: string };
  kicker: readonly string[];
  /** The pick (null until the first tap). */
  chosen: number | null;
  /** Show the key: only once the answer is locked (it is, the moment it is chosen). */
  revealed: boolean;
  onChoose?: (i: number, elapsedMs: number) => void;
  elapsedMs?: number | null;
  busy?: boolean;
  stemId?: string;
};

export function QuestionCard({ card, kicker, chosen, revealed, onChoose, elapsedMs, busy, stemId }: QuestionCardProps) {
  const { t, isHi } = useLang();
  const auto = useId();
  const id = stemId ?? `${auto}-stem`;
  const locked = chosen !== null;
  const clock = useMemo(() => createStopwatch(), [card.factId, card.question]);
  const attempt = useMemo<{ choice: number | null }>(() => ({ choice: null }), [clock]);
  useLayoutEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => clock.start()); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [clock]);
  const choose = (i: number) => {
    if (locked || busy || clock.locked) return;
    const ms = clock.lock();
    if (ms !== null) { attempt.choice = i; onChoose?.(i, ms); }
  };
  const forward = itemForCard(card)?.kind === 'forward';
  return (
    <section className={cx('h-qcard', forward && 'h-qcard--fwd')} aria-labelledby={id}>
      {kicker.length ? (
        <Kicker className="h-qcard__kicker" lang={isHi ? 'hi' : undefined}>
          {kicker.join(' · ')}
        </Kicker>
      ) : null}
      {forward ? (
        <ForwardStem id={id} question={card.question} locked={locked} />
      ) : (
        <h2 className="h-qcard__stem" id={id} lang="en" tabIndex={-1}>
          {card.question}
        </h2>
      )}
      {!locked || typeof elapsedMs === 'number' ? <Stopwatch clock={clock} lockedMs={elapsedMs} /> : null}
      <OptionList
        options={card.options}
        chosen={chosen}
        correctIndex={revealed ? card.correctIndex : null}
        onChoose={locked || busy || clock.locked ? undefined : choose}
        disabled={locked || busy || clock.locked}
        keys={!locked && !clock.locked}
        label={t('Answers', 'जवाब')}
        className="h-qcard__opts"
      />
      {!locked && clock.locked && !busy && attempt.choice !== null ? <div role="alert" className="h-qcard__hint">
        <p>{t('Your answer is locked on this screen. Retry saving the same answer and time.', 'जवाब इस स्क्रीन पर लॉक है। वही जवाब और समय फिर से सेव करें।')}</p>
        <Button variant="paper" onClick={() => { if (attempt.choice !== null) onChoose?.(attempt.choice, clock.elapsed()); }}>{t('Retry saving answer', 'जवाब फिर सेव करें')}</Button>
      </div> : null}
      {!locked && !clock.locked ? (
        <p className="h-qcard__hint">{t('No deadline. Take your time — first-time correct answers earn XP. First answer locks.', 'कोई समय सीमा नहीं। आराम से पढ़ें — पहले सही जवाब पर XP। पहला जवाब लॉक होगा।')}</p>
      ) : null}
    </section>
  );
}

// ---- after the lock -------------------------------------------------------------------------------

export type CardResultProps = {
  card: Pick<Card, 'factId' | 'options' | 'correctIndex' | 'explanation' | 'sourceUrl' | 'sourceLabel'>;
  item: BankItem | null;
  choice: number;
  elapsedMs?: number | null;
  /** Answered in this visit: the stamp slams and the receipt prints (once). */
  fresh: boolean;
  receiptNo?: number | null;
  xp?: XpLine | null;
  /** 'receipt' (answer + source + status) or 'challenge' (no answer: the daily, so nobody's day is spoilt). */
  share: ReceiptShareVariant;
  /** Extra actions after Open source / Forward (the taster's next steps). */
  children?: ReactNode;
};

export const CardResult = forwardRef<HTMLElement, CardResultProps>(function CardResult(
  { card, item, choice, elapsedMs, fresh, receiptNo, xp, share, children },
  ref,
) {
  const { t, isHi } = useLang();
  const right = choice === card.correctIndex;
  const pts = xp?.answerXp;
  const headId = useId();
  const sharer = useShareState();
  const otherSide = otherSideOf(item);
  const verdictLine = right ? t('Waah Waah! Receipt mil gayi.', 'वाह वाह! रसीद मिल गई।') : t('Galat. Par receipt toh le lo.', 'ग़लत। पर रसीद तो ले लो।');
  return (
    <section ref={ref} className="h-cardres" aria-labelledby={headId} tabIndex={-1}>
      <div className="h-cardres__verdict h-stamp-stage">
        <h2 className="h-sr" id={headId}>
          {right ? t('Correct', 'सही') : t('Wrong', 'ग़लत')}
        </h2>
        <Stamp kind={right ? 'pass' : 'fail'} seed={card.factId} size="l" animate={fresh} label={right ? 'Correct' : 'Wrong'} />
        <p className="h-cardres__line">{verdictLine}</p>
        <p className="h-cardres__answer" aria-live="polite">
          <span className="h-cardres__k">{t('ANSWER', 'जवाब')}</span>
          <span className="h-cardres__v" lang="en">
            {card.options[card.correctIndex]}
          </span>
        </p>
        {pts !== undefined ? <p className="h-cardres__call">
          <span className="h-cardres__k">{t('ANSWER XP', 'जवाब XP')}</span>
          <span className="h-cardres__v"><span className="h-mono">{signed(pts)} XP</span>{typeof elapsedMs === 'number' ? ` · ${(Math.floor(elapsedMs / 100) / 10).toFixed(1)} s` : ''}</span>
        </p> : null}
      </div>
      <Receipt
        item={item}
        receiptNo={receiptNo ?? undefined}
        xp={xp?.xp}
        xpNote={xp?.note}
        otherSide={otherSide ?? undefined}
        printing={fresh}
        extra={
          item
            ? undefined
            : [
                [
                  'SOURCE',
                  <a key="s" className="h-receipt__link" href={card.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {card.sourceLabel}
                  </a>,
                ],
              ]
        }
      />
      <NotingSheet title={t('Noting', 'नोटिंग')}>
        <p lang="en">{card.explanation}</p>
      </NotingSheet>
      <div className="h-cardres__actions">
        <Button
          variant="paper"
          size="s"
          href={card.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          icon={<ExternalLink size={18} strokeWidth={2.4} />}
        >
          {t('Open source', 'सोर्स खोलो')}
          <span className="h-sr"> {t('(opens in a new tab)', '(नए टैब में)')}</span>
        </Button>
        {item ? (
          <Button
            variant="ghost"
            size="s"
            icon={<Forward size={18} strokeWidth={2.4} />}
            busy={sharer.state.status === 'busy'}
            onClick={() => void sharer.run(() => shareReceipt(item, share))}
          >
            <span aria-live="polite">{shareWords(sharer.state, t(SHARE_CTA, 'फ़ॉरवर्ड करो — इसका सोर्स है'), t)}</span>
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
});

// ---- the sticky action -------------------------------------------------------------------------------

export function PlayBar({ children }: { children: ReactNode }) {
  return (
    <div className="h-playbar">
      <div className="h-playbar__inner">{children}</div>
    </div>
  );
}

// ---- feedback cues ----------------------------------------------------------------------------------

/**
 * The lock → stamp → print cues (bible §6 #2–#5), sequenced so no more than three sounds land within
 * 100 ms: select + light haptic on the tap, stamp + correct/wrong at 120 ms, one print tick at 420 ms,
 * and a short whoosh for the tape at 520 ms. Only ever called after an answer locks.
 */
export function useLockCues() {
  const juice = useJuice();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );
  return (right: boolean, tape = false) => {
    juice.sound('select');
    juice.haptic('light');
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    later(120, () => {
      juice.sound('stamp');
      juice.sound(right ? 'correct' : 'wrong');
      juice.haptic(right ? 'success' : 'error');
    });
    later(420, () => juice.sound('tick'));
    if (tape)
      later(520, () => {
        juice.sound('whoosh');
        juice.haptic('light');
      });
  };
}

/** Bring the result into view after a lock (smooth unless motion is reduced) and move focus to it. */
export function revealResult(el: HTMLElement | null) {
  if (!el) return;
  const reduced =
    document.documentElement.getAttribute('data-motion') === 'reduced' ||
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;
  el.focus({ preventScroll: true });
  // Desktop: the receipt prints beside the question — leave the page where it is if its top is in view.
  if (wide && el.getBoundingClientRect().top < window.innerHeight * 0.6) return;
  el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
}

/** N / → moves to the next card once a card is locked (keyboard players). */
export function useNextKey(active: boolean, onNext: () => void) {
  const fn = useRef(onNext);
  useEffect(() => {
    fn.current = onNext;
  });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') {
        e.preventDefault();
        fn.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}
