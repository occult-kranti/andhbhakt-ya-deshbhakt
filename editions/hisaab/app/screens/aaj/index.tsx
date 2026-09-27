/**
 * screens/aaj/index.tsx — #/aaj, Aaj Ka Hisaab: today's five, the same for everyone that local day
 * (design bible §11.7; ENGINE.md §8; notification rules §9).
 *
 *   const { day, cards } = todaysFive();
 *   player.dispatch({ type: 'practice', fact: cards[i], choice, confidence, roundId: dailyRoundId(day, i) });
 *
 * The journal is the record: answered cards are read back from the rounds filed under
 * dailyRoundId(day, i) (Home reads the same ids), so a reload resumes at the first unanswered card and
 * replaying earns nothing twice. Cards are untimed and quiet (nothing moves before the lock; toasts
 * wait for the finish). Finish: THAPPA, the ✓/✕ grid, score, streak and the static "New file at
 * 00:00 IST" — no countdown — and the one violet primary, Share today's grid (text; ✅ ❌ only).
 * Ceremony here: `label` only (the shell's watcher raises it); never `file`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Flame, Share2, X } from 'lucide-react';
import { dailyRoundId, standing, todaysFive, type Card } from '../../../edition';
import { useHoldToasts } from '../../budget';
import { answerXp } from '../../../engine/scoring.mjs';
import { bandProgress, formatNumber, goalCopy, itemForCard, labelDisplay, labelLine } from '../../data';
import { goBack, href, type ScreenProps } from '../../router';
import { shareDailyGrid } from '../../share';
import { useChrome, useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { preloadSetPiece, sceneCapability, Thappa } from '../../three';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { EmptyState, InlineNote, Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { Meter } from '../../ui/meter';
import { Kicker } from '../../ui/text';
import { CardResult, PlayBar, PlayHeader, QuestionCard, revealResult, useLockCues, useNextKey, type SegmentState } from '../route/card';
import {
  cardKicker,
  choiceOf,
  newFileLine,
  receiptCount,
  receiptOrdinal,
  roundsById,
  shareWords,
  signed,
  useShareState,
  xpForRound,
  type Journal,
  type Progression,
} from '../route/lib';
import { ReceiptStrip } from '../route/receipt-strip';
import { LabelCard } from '../start/label-card';
import './aaj.css';

type DailyAnswer = { choice: number | null; correct: boolean; elapsedMs: number | null };
type Pending = { index: number; choice: number; elapsedMs: number };

const STEM_ID = 'h-aaj-stem';

export default function AajScreen(_: ScreenProps) {
  const player = useAppPlayer();
  const { t, isHi } = useLang();
  const cues = useLockCues();
  useScreenTitle('Aaj Ka Hisaab');

  // The day is fixed for this visit: a player who crosses midnight mid-file finishes the file they opened.
  const daily = useMemo(() => todaysFive(), []);
  const { day, cards } = daily;
  const size = cards.length;

  const profile = player.profile as { journal?: Journal; progression?: Progression } | null;
  const journal = profile?.journal;
  const rounds = useMemo(() => roundsById(journal), [journal]);
  const answers: (DailyAnswer | null)[] = cards.map((c, i) => {
    const r = rounds.get(dailyRoundId(day, i));
    return r ? { choice: choiceOf(r, c.options), correct: r.correct === true, elapsedMs: r.elapsedMs ?? null } : null;
  });
  const firstOpen = answers.findIndex((a) => !a);

  const [index, setIndex] = useState<number | 'done' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [revealAt, setRevealAt] = useState<number | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  // The first receipt EVER (first run → "Open today's file"): the inline label card follows it (bible
  // §11.1, never a ceremony). Receipts held before this visit, read once the profile has loaded.
  const [before, setBefore] = useState<number | null>(null);
  const [firstAt, setFirstAt] = useState<number | null>(null);
  useEffect(() => {
    if (player.loaded && before === null) setBefore(receiptCount(journal));
  }, [player.loaded, before, journal]);

  // Land on the first unanswered card, or the finish when today's file is already filed.
  useEffect(() => {
    if (index === null && player.loaded) setIndex(firstOpen === -1 ? 'done' : firstOpen);
  }, [index, player.loaded, firstOpen]);

  const playing = player.loaded && index !== 'done' && size > 0;
  useChrome(playing ? 'top' : null);
  useHoldToasts(playing);

  useEffect(() => {
    if (revealAt !== null) revealResult(resultRef.current);
  }, [revealAt]);

  const i = typeof index === 'number' ? index : 0;
  const card: Card | null = typeof index === 'number' ? (cards[index] ?? null) : null;
  const stored = typeof index === 'number' ? answers[index] : null;
  const pend = pending && pending.index === index ? pending : null;
  const answer = stored
    ? { choice: stored.choice ?? pend?.choice ?? null, elapsedMs: stored.elapsedMs }
    : pend
      ? { choice: pend.choice, elapsedMs: pend.elapsedMs }
      : null;

  const choose = async (choice: number, elapsedMs: number) => {
    if (!card || answer || busy || typeof index !== 'number') return;
    setPending({ index, choice, elapsedMs });
    if (before === 0 && firstAt === null) setFirstAt(index);
    setFresh((s) => new Set(s).add(index));
    setRevealAt(index);
    cues(choice === card.correctIndex);
    setBusy(true);
    try {
      await player.dispatch({ type: 'practice', fact: card, choice, elapsedMs, roundId: dailyRoundId(day, index) });
    } catch {
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  // Every card is filed: warm THAPPA's chunk for the finish (no WebGL until the finish mounts).
  const allFiled = answers.every(Boolean);
  useEffect(() => {
    if (allFiled && typeof index === 'number' && sceneCapability().ok) preloadSetPiece('thappa');
  }, [allFiled, index]);

  const next = () => {
    if (typeof index !== 'number' || !answer || busy) return;
    // The next card not yet answered (another tab may have filed some), else the finish.
    let n = -1;
    for (let k = index + 1; k < size; k += 1)
      if (!answers[k]) {
        n = k;
        break;
      }
    if (n === -1) n = answers.findIndex((a, k) => !a && k !== index);
    setRevealAt(null);
    setIndex(n === -1 ? 'done' : n);
    window.scrollTo({ top: 0 });
    if (n !== -1) requestAnimationFrame(() => document.getElementById(STEM_ID)?.focus({ preventScroll: true }));
  };
  useNextKey(!!answer && !busy && typeof index === 'number', next);

  if (!player.loaded || index === null)
    return (
      <Page screen="aaj" className="h-play">
        <Skeleton lines={6} label={t("Opening today's file", 'आज की फ़ाइल खुल रही है')} />
      </Page>
    );

  if (!size)
    return (
      <Page screen="aaj" width="read">
        <ScreenHeader kicker={`F.No. D/${day}`} titleHi="आज का हिसाब" title="Aaj Ka Hisaab" />
        <EmptyState line={t('Aaj ki file khaali hai. The bank has no cards yet.', 'आज की फ़ाइल ख़ाली है।')} action={<Button href={href.files()}>{t('Open the records room', 'रिकॉर्ड रूम खोलो')}</Button>} />
      </Page>
    );

  if (index === 'done') return <AajFinish day={day} cards={cards} answers={answers} journal={journal} progression={profile?.progression} />;

  if (!card) return null;
  const item = itemForCard(card);
  const segments: SegmentState[] = cards.map((_, k) =>
    answers[k] || (k === i && answer) ? 'done' : k === i ? 'current' : 'todo',
  );
  const answeredCount = answers.filter(Boolean).length;
  return (
    <Page screen="aaj" className="h-play">
      <PlayHeader
        fno={`F.No. D/${day}`}
        title="Aaj Ka Hisaab"
        titleHi="आज का हिसाब"
        index={i}
        total={size}
        segments={segments}
        sub={answeredCount === 0 ? t('Aaj ke 5 sawaal. Sabke liye same.', 'आज के 5 सवाल। सबके लिए एक जैसे।') : t(`${answeredCount} of ${size} filed`, `${size} में से ${answeredCount} फ़ाइल`)}
        closeHref={href.home()}
        closeLabel={t('Save and exit', 'सेव करके बाहर')}
        onClose={() => goBack(href.home())}
      />
      {!player.persistent && player.storageError ? <InlineNote tone="wait">{player.storageError}</InlineNote> : null}
      <div className="h-play__grid">
        <div className="h-play__main">
          <QuestionCard
            key={`${day}:${i}`}
            card={card}
            kicker={cardKicker(card, item, isHi)}
            chosen={answer ? answer.choice : null}
            revealed={!!answer}
            onChoose={(c, ms) => void choose(c, ms)}
            elapsedMs={answer?.elapsedMs}
            busy={busy && !answer}
            stemId={STEM_ID}
          />
        </div>
        <div className="h-play__side">
          {answer && answer.choice !== null ? (
            <>
              <CardResult
                ref={resultRef}
                key={`${day}:${i}`}
                card={card}
                item={item}
                choice={answer.choice}
                elapsedMs={answer.elapsedMs}
                fresh={fresh.has(i)}
                receiptNo={stored ? receiptOrdinal(journal, card.factId) : null}
                xp={stored ? xpForRound(rounds, profile?.progression?.log, dailyRoundId(day, i)) : null}
                share="challenge"
              />
              {firstAt === i && stored ? <LabelCard xp={profile?.progression?.xp ?? 0} intro as="h3" className="h-aaj__label" /> : null}
            </>
          ) : (
            <div className="h-play__wait" aria-hidden="true">
              <Kicker>RECEIPT</Kicker>
              <p>{t('The receipt prints here once you answer.', 'जवाब देते ही रसीद यहाँ छपेगी।')}</p>
            </div>
          )}
        </div>
      </div>
      {answer ? (
        <PlayBar>
          <Button variant="primary" block onClick={next} busy={busy} disabled={!stored}>
            {answeredCount >= size ? t("Close today's file", 'आज की फ़ाइल बंद करो') : t('Next card', 'अगला कार्ड')}
          </Button>
        </PlayBar>
      ) : null}
    </Page>
  );
}

// ---- the finish ------------------------------------------------------------------------------------

function AajFinish({
  day,
  cards,
  answers,
  journal,
  progression,
}: {
  day: string;
  cards: readonly Card[];
  answers: readonly (DailyAnswer | null)[];
  journal: Journal;
  progression: Progression;
}) {
  const { t, isHi } = useLang();
  const sharer = useShareState();
  const results = answers.map((a) => a?.correct === true);
  const right = results.filter(Boolean).length;
  const size = cards.length;
  const pts = answers.every(a => typeof a?.elapsedMs === 'number') ? answers.reduce((s, a) => s + answerXp(a?.correct === true, a?.elapsedMs), 0) : null;
  const xpNow = progression?.xp ?? 0;
  const s = standing(xpNow);
  const label = labelDisplay(s.band);
  const meter = bandProgress(xpNow);
  const streak = progression?.streak;
  const streakDays = streak && streak.lastDay === day ? streak.current : null;
  const [y, m, d] = day.split('-').map(Number);
  const dateText = new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
  const minis = cards.map((card, k) => ({ card, item: itemForCard(card), right: answers[k] ? answers[k]!.correct : null }));

  return (
    <Page screen="aaj-done" className="h-aaj">
      <ScreenHeader
        kicker={`F.No. D/${day} · ${t('FILED', 'फ़ाइल')}`}
        titleHi="आज का हिसाब"
        title="Aaj Ka Hisaab"
        lead={t('Aaj ka hisaab ho gaya. Kal naya file.', 'आज का हिसाब हो गया। कल नई फ़ाइल।')}
      />
      <div className="h-aaj__grid">
        <div className="h-aaj__stamp h-stamp-stage">
          <Thappa text={`FILED · ${right}/${size}`} kind="noted" seed={`aaj-${day}`} height={160} />
          <p className="h-aaj__date">
            <CalendarDays size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>{dateText}</span>
          </p>
        </div>
        <div className="h-aaj__summary">
          <ol className="h-aaj__cells" aria-label={t(`Today's grid: ${right} of ${size} right`, `आज का ग्रिड: ${size} में ${right} सही`)}>
            {results.map((ok, k) => (
              <li key={k} className={cx('h-aaj__cell', ok ? 'h-aaj__cell--pass' : 'h-aaj__cell--fail')}>
                {ok ? <Check size={22} strokeWidth={3} aria-hidden="true" /> : <X size={22} strokeWidth={3} aria-hidden="true" />}
                <span className="h-sr">
                  {t(`Card ${k + 1}: ${ok ? 'right' : 'wrong'}`, `कार्ड ${k + 1}: ${ok ? 'सही' : 'ग़लत'}`)}
                </span>
              </li>
            ))}
          </ol>
          <p className="h-aaj__score">
            <span className="h-mono">
              {right}/{size}
            </span>{' '}
            {t('right', 'सही')}
            {pts !== null ? (
              <>
                <span aria-hidden="true"> · </span>
                <span className="h-mono">{signed(pts)}</span> {t('answer XP', 'जवाब XP')}
              </>
            ) : null}
          </p>
          <div className="h-aaj__label">
            <Kicker as="span">{t(`YOUR LABEL · LEVEL ${s.level}`, `आपका लेबल · लेवल ${s.level}`)}</Kicker>
            <p className="h-aaj__labelname">
              <span lang="hi" className="h-aaj__labelhi">
                {label.hi}
              </span>
              <span className="h-aaj__labelen" lang="en">
                {label.en}
                {label.aside ? (
                  <span className="h-aaj__aside" lang={isHi && label.asideHi ? 'hi' : undefined}>
                    {' '}
                    {isHi && label.asideHi ? label.asideHi : label.aside}
                  </span>
                ) : null}
              </span>
            </p>
            <p className="h-aaj__line" lang={isHi ? 'hi' : undefined}>
              {labelLine(label, isHi)}
            </p>
            {/* The goal gradient (bible §8.2): how far today's file moved the player towards the next label. */}
            <Meter
              className="h-aaj__meter"
              value={meter.value}
              max={meter.max}
              ticks={5}
              label={t('Progress to the next label', 'अगले लेबल तक')}
              valueText={isHi ? `लेवल ${s.level}। ${goalCopy(xpNow, 'hi')}` : `Level ${s.level}. ${goalCopy(xpNow)}`}
              copy={goalCopy(xpNow, isHi ? 'hi' : 'en')}
            />
          </div>
          <ul className="h-aaj__facts">
            {streakDays !== null ? (
              <li>
                <Flame size={18} strokeWidth={2.4} aria-hidden="true" />
                <span>
                  {t(`Streak: ${formatNumber(streakDays)} ${streakDays === 1 ? 'day' : 'days'} · today counted`, `स्ट्रीक: ${formatNumber(streakDays)} दिन · आज गिना गया`)}
                  {streak && streak.shields > 0 ? t(` · ${streak.shields} CL in hand`, ` · ${streak.shields} CL बाक़ी`) : ''}
                </span>
              </li>
            ) : null}
            <li>
              <CalendarDays size={18} strokeWidth={2.4} aria-hidden="true" />
              <span>{newFileLine(t)}</span>
            </li>
          </ul>
          <div className="h-aaj__actions">
            <Button
              variant="primary"
              block
              icon={<Share2 size={20} strokeWidth={2.4} />}
              busy={sharer.state.status === 'busy'}
              onClick={() => void sharer.run(() => shareDailyGrid({ day, results, label: label.en }))}
            >
              <span aria-live="polite">{shareWords(sharer.state, t("Share today's grid", 'आज का ग्रिड भेजो'), t)}</span>
            </Button>
            <div className="h-aaj__row">
              <Button variant="paper" size="s" href={href.files()}>
                {t('Open a file', 'कोई फ़ाइल खोलो')}
              </Button>
              <Button variant="ghost" size="s" href={href.home()}>
                {t('Home', 'होम')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ReceiptStrip
        entries={minis}
        title={t("Today's receipts", 'आज की रसीदें')}
        lead={t(
          'Forwarding one sends the question and options with the answer unmarked (a case’s legal status line always travels with it) — same five for everyone today.',
          'भेजने पर सवाल और विकल्प जाते हैं, जवाब चिह्नित नहीं (किसी मामले की क़ानूनी स्थिति हमेशा साथ जाती है) — आज सबके लिए यही पाँच।',
        )}
        share="challenge"
      />
    </Page>
  );
}
