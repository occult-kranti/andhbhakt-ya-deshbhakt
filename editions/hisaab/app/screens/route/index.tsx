/**
 * screens/route/index.tsx — #/route/:id, the untimed route player and its finish (design bible §11.7,
 * §11.13; notification rules §9; engine ENGINE.md §7).
 *
 * Driving the engine exactly as ENGINE §7 shows:
 *   request({ action: 'expedition', routeId })  → six cards; version + validExpeditionCards checked
 *   journey-start (runId, previousRunId, cards)  → dispatched with the FIRST answer: the tape is cut by
 *                                                  answering, so a peek never leaves a half-open file
 *   journey-answer (index, choice, confidence)   → the lock; stamp, receipt and XP read back from the profile
 *   journey-next (index)                         → Next card; after the sixth, the finish
 *   player.fold(routeId, runId)                  → "Start this file over" (the engine allows one a day)
 *
 * States: loading (skeleton) · a card (open run, or a fresh deal for a new/replayed/folded file) ·
 * the finish (#/route/:id?done=<runId>, so a reload keeps it) · an error ("File missing. Babu is on
 * leave." + Retry). While a card is up the nav is hidden (× saves and exits) and toasts are held for
 * the finish; nothing animates before an answer locks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { request } from '@/lib/duel-client';
import { validExpeditionCards } from '@/lib/expeditions.mjs';
import { dayKey } from '@/lib/journal.mjs';
import { routeById, type Card, type Route } from '../../../edition';
import { useBudget, useHoldToasts } from '../../budget';
import { itemForCard } from '../../data';
import { goBack, href, navigate, queryString, type ScreenProps } from '../../router';
import { useChrome, useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { preloadSetPiece, sceneCapability } from '../../three';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import { ErrorState, InlineNote, Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { Kicker } from '../../ui/text';
import { CardResult, PlayBar, PlayHeader, QuestionCard, revealResult, useLockCues, useNextKey, type SegmentState } from './card';
import { LabelCard } from '../start/label-card';
import { RouteFinish } from './finish';
import {
  cardKicker,
  fileNo,
  hubHref,
  journeyRoundId,
  receiptCount,
  receiptOrdinal,
  roundsById,
  routeTitleHi,
  RUN_CARDS,
  xpForRound,
  type Journal,
  type JourneyRecord,
  type Journeys,
  type Progression,
  type RunAnswer,
} from './lib';
import './route.css';

export default function RouteScreen({ route: at }: ScreenProps) {
  const route = routeById(at.params.id ?? '');
  if (!route) return <MissingFile />;
  return <RoutePlayer key={route.id} route={route} done={at.query.done ?? null} />;
}

function MissingFile() {
  const { t } = useLang();
  useScreenTitle(t('File missing', 'फ़ाइल गायब'));
  return (
    <Page screen="route-missing" width="read">
      <ScreenHeader kicker="F.No. ——" title={t('File missing', 'फ़ाइल गायब')} />
      <ErrorState detail={t('This file is not in the records room. It may have moved when the bank was updated.', 'यह फ़ाइल रिकॉर्ड रूम में नहीं है।')} />
      <Button variant="primary" href={href.files()}>
        {t('Open the records room', 'रिकॉर्ड रूम खोलो')}
      </Button>
    </Page>
  );
}

const STEM_ID = 'h-route-stem';

type Draft = { cards: Card[]; runId: string };
type Pending = { runId: string; index: number } & RunAnswer;
export type JustFinished = { runId: string; wasFirst: boolean; prevBest: number | null };

const newRunId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function RoutePlayer({ route, done }: { route: Route; done: string | null }) {
  const player = useAppPlayer();
  const budget = useBudget();
  const { t, isHi } = useLang();
  const cues = useLockCues();
  useScreenTitle(route.title);

  const profile = player.profile as { journeys?: Journeys; journal?: Journal; progression?: Progression } | null;
  const journeys: Journeys = profile?.journeys ?? {};
  const record: JourneyRecord | undefined = journeys[route.key];
  const run = record?.run ?? null;
  const open = run && run.cursor < RUN_CARDS && !record?.folded ? run : null;
  const finished = run && run.cursor === RUN_CARDS && done === run.id ? run : null;

  // The latest record, for handlers that run after an await.
  const recordRef = useRef(record);
  recordRef.current = record;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [dealError, setDealError] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [tapeCut, setTapeCut] = useState<'no' | 'snapping' | 'cut'>('no');
  const [busy, setBusy] = useState(false);
  const [filingError, setFilingError] = useState(false);
  const [justFinished, setJustFinished] = useState<JustFinished | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [confirmFold, setConfirmFold] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  // The first receipt EVER (first run → "Pick a state instead"): the inline label card follows it
  // (bible §11.1, never a ceremony). Receipts held before this visit, read once the profile loads.
  const [before, setBefore] = useState<number | null>(null);
  const [firstKey, setFirstKey] = useState<string | null>(null);
  useEffect(() => {
    if (player.loaded && before === null) setBefore(receiptCount(profile?.journal));
  }, [player.loaded, before, profile?.journal]);

  const playing = player.loaded && !finished && !dealError;
  useChrome(playing ? 'top' : null);
  useHoldToasts(playing);

  // A stale ?done= (another run, or a run still open) is dropped from the address.
  useEffect(() => {
    if (!player.loaded || !done || finished) return;
    navigate(href.route(route.id), { replace: true });
  }, [player.loaded, done, finished, route.id]);

  // Deal six cards when there is no open run to resume (new, cleared, or folded file).
  const deal = useCallback(async () => {
    setDealError(false);
    try {
      const data = await request({ action: 'expedition', routeId: route.id });
      if (!data || data.version !== route.version || !validExpeditionCards(data.cards, route)) throw new Error('unchecked');
      setDraft({ cards: data.cards as Card[], runId: newRunId() });
    } catch {
      setDraft(null);
      setDealError(true);
    }
  }, [route]);
  const needsDeal = player.loaded && !open && !finished && !done;
  useEffect(() => {
    if (needsDeal && !draft && !dealError) void deal();
  }, [needsDeal, draft, dealError, deal]);
  // Once the dealt run exists in the profile, the profile is the source of truth.
  useEffect(() => {
    if (open && draft && open.id === draft.runId) setDraft(null);
  }, [open, draft]);

  const cards = open?.cards ?? draft?.cards ?? null;
  const runId = open?.id ?? draft?.runId ?? null;
  const cursor = open?.cursor ?? 0;
  const card = cards?.[cursor] ?? null;
  const stored = open?.answers[cursor] ?? null;
  const pend = pending && pending.runId === runId && pending.index === cursor ? pending : null;
  const answer: RunAnswer | null = stored ?? (pend ? { choice: pend.choice, elapsedMs: pend.elapsedMs } : null);
  const item = useMemo(() => itemForCard(card), [card]);
  const sealed = !record?.first && !open;

  // A refused write (the file changed under us, another tab) surfaces as an inline error, not silence.
  useEffect(() => {
    // (The profile is set before dispatch resolves, so once busy drops the run must hold the answer.)
    if (!busy && pend && !stored) {
      setFilingError(true);
      setPending(null);
    }
  }, [busy, pend, stored]);

  useEffect(() => {
    if (revealKey) revealResult(resultRef.current);
  }, [revealKey]);

  const tapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (tapeTimer.current) clearTimeout(tapeTimer.current);
  }, []);
  const tapeDone = useCallback(() => {
    if (tapeTimer.current) clearTimeout(tapeTimer.current);
    setTapeCut((s) => (s === 'snapping' ? 'cut' : s));
  }, []);

  const choose = async (choice: number, elapsedMs: number) => {
    if (!card || !cards || !runId || answer || busy) return;
    const right = choice === card.correctIndex;
    const index = cursor;
    const key = `${runId}:${index}`;
    const cutting = sealed && index === 0;
    setFilingError(false);
    setPending({ runId, index, choice, elapsedMs });
    if (before === 0 && firstKey === null) setFirstKey(key);
    setFresh((s) => new Set(s).add(key));
    setRevealKey(key);
    if (cutting) {
      setTapeCut('snapping');
      tapeTimer.current = setTimeout(tapeDone, 900);
    }
    cues(right, cutting);
    setBusy(true);
    try {
      if (!open)
        await player.dispatch({
          type: 'journey-start',
          routeId: route.id,
          runId,
          previousRunId: recordRef.current?.run?.id ?? null,
          cards,
        });
      await player.dispatch({ type: 'journey-answer', routeId: route.id, runId, index, choice, elapsedMs });
    } catch {
      setFilingError(true);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  // The last card is answered: warm the finish's set pieces (FILE PILE, and THAPPA for a first clear's
  // ceremony) so they paint inside their deadlines. Chunks only — no WebGL until the finish mounts.
  const lastAnswered = !!open && open.cursor === RUN_CARDS - 1 && !!stored;
  const firstClear = !record?.first;
  useEffect(() => {
    if (!lastAnswered || !sceneCapability().ok) return;
    preloadSetPiece('pile');
    if (firstClear) preloadSetPiece('thappa');
  }, [lastAnswered, firstClear]);

  const next = async () => {
    if (!open || !stored || busy) return;
    const index = open.cursor;
    const last = index === RUN_CARDS - 1;
    const before = recordRef.current;
    setBusy(true);
    try {
      await player.dispatch({ type: 'journey-next', routeId: route.id, runId: open.id, index });
    } finally {
      setBusy(false);
    }
    setRevealKey(null);
    setConfirmFold(false);
    if (last) {
      setJustFinished({ runId: open.id, wasFirst: !before?.first, prevBest: before?.first ? (before.best?.correct ?? null) : null });
      navigate(`${href.route(route.id)}${queryString({ done: open.id })}`, { replace: true });
      window.scrollTo({ top: 0 });
      return;
    }
    window.scrollTo({ top: 0 });
    // Keyboard and screen-reader players land on the new question, not on <body>.
    requestAnimationFrame(() => document.getElementById(STEM_ID)?.focus({ preventScroll: true }));
  };
  useNextKey(!!stored && !busy && !!open, () => void next());

  const startOver = async () => {
    if (!open || busy) return;
    setBusy(true);
    try {
      await player.fold(route.id, open.id);
    } finally {
      setBusy(false);
    }
    setConfirmFold(false);
    setPending(null);
    setDraft(null);
    setTapeCut('no');
    setRevealKey(null);
    window.scrollTo({ top: 0 });
  };

  // ---- render ----------------------------------------------------------------------------------

  if (!player.loaded)
    return (
      <Page screen="route" className="h-play">
        <Skeleton lines={6} label={t('Opening the file', 'फ़ाइल खुल रही है')} />
      </Page>
    );

  if (finished)
    return (
      <RouteFinish
        route={route}
        record={record!}
        run={finished}
        journeys={journeys}
        journal={profile?.journal}
        progression={profile?.progression}
        justFinished={justFinished && justFinished.runId === finished.id ? justFinished : null}
      />
    );

  const titleHi = routeTitleHi(route);
  const close = () => goBack(hubHref(route));

  if (dealError || !card || !cards || !runId)
    return (
      <Page screen="route" className="h-play">
        <ScreenHeader kicker={fileNo(route)} titleHi={titleHi} title={route.title} />
        {dealError ? (
          <>
            <ErrorState
              detail={t('The cards for this file could not be checked, so they were not dealt.', 'इस फ़ाइल के कार्ड जाँचे नहीं जा सके।')}
              onRetry={() => void deal()}
            />
            <Button variant="paper" href={hubHref(route)}>
              {t('Back to the files', 'फ़ाइलों पर वापस')}
            </Button>
          </>
        ) : (
          <Skeleton lines={6} label={t('Dealing six cards', 'छह कार्ड बँट रहे हैं')} />
        )}
      </Page>
    );

  const answers = open?.answers ?? [];
  const segments: SegmentState[] = Array.from({ length: RUN_CARDS }, (_, i) =>
    i < cursor || (i === cursor && answer) ? 'done' : i === cursor ? 'current' : 'todo',
  );
  const scored = [...answers.slice(0, cursor), ...(answer ? [answer] : [])];
  const score = scored.length
    ? scored.reduce((s, a, i) => s + Number(a.choice === cards[i]?.correctIndex), 0)
    : null;
  // Once cut, the tape stays mounted (its halves have fallen and faded) for the rest of card 1, so the
  // strip keeps its height and the receipt the player was scrolled to does not jump.
  const tape = tapeCut !== 'no' && cursor === 0 ? 'snapping' : sealed && cursor === 0 && !answer ? 'idle' : null;
  const chapter = route.chapters[Math.min(route.chapters.length - 1, Math.floor(cursor / 2))];
  const replay = record?.first ? record : null;
  const rounds = roundsById(profile?.journal);
  const roundId = journeyRoundId(runId, cursor);
  const isFresh = fresh.has(`${runId}:${cursor}`);
  const canFold = !!open && open.answers.length >= 1 && record?.foldedDay !== dayKey(Date.now());

  return (
    <Page screen="route" className="h-play">
      <PlayHeader
        fno={fileNo(route)}
        title={route.title}
        titleHi={titleHi}
        index={cursor}
        total={RUN_CARDS}
        segments={segments}
        score={score}
        sub={
          <>
            <span>{chapter}</span>
            {route.padded.length ? <span className="h-route__padded"> · {route.subtitle}</span> : null}
            {replay?.best ? (
              <span className="h-route__replay">
                {' · '}
                {t(`Replay · best ${replay.best.correct}/6`, `दोबारा · सबसे अच्छा ${replay.best.correct}/6`)}
              </span>
            ) : null}
          </>
        }
        tape={tape}
        onTapeSnapped={tapeDone}
        note={tapeCut !== 'no' && cursor === 0 ? t('Tape cut. 1 of 6.', 'फ़ीता कट गया। 6 में से 1।') : null}
        closeHref={hubHref(route)}
        closeLabel={t('Save and exit', 'सेव करके बाहर')}
        onClose={close}
      />
      {!player.persistent && player.storageError ? <InlineNote tone="wait">{player.storageError}</InlineNote> : null}
      <div className="h-play__grid">
        <div className="h-play__main">
          <QuestionCard
            key={`${runId}:${cursor}`}
            card={card}
            kicker={cardKicker(card, item, isHi)}
            chosen={answer ? answer.choice : null}
            revealed={!!answer}
            onChoose={(i, ms) => void choose(i, ms)}
            elapsedMs={answer?.elapsedMs}
            busy={busy && !answer}
            stemId={STEM_ID}
          />
        </div>
        <div className="h-play__side">
          {answer ? (
            <>
              <CardResult
                ref={resultRef}
                key={`${runId}:${cursor}`}
                card={card}
                item={item}
                choice={answer.choice}
                elapsedMs={answer.elapsedMs}
                fresh={isFresh}
                receiptNo={stored ? receiptOrdinal(profile?.journal, card.factId) : null}
                xp={stored ? xpForRound(rounds, profile?.progression?.log, roundId) : null}
                share="receipt"
              />
              {firstKey === `${runId}:${cursor}` && stored ? (
                <LabelCard xp={profile?.progression?.xp ?? 0} intro as="h3" className="h-route__label" />
              ) : null}
            </>
          ) : (
            <div className="h-play__wait" aria-hidden="true">
              <Kicker>RECEIPT</Kicker>
              <p>{t('The receipt prints here once you answer.', 'जवाब देते ही रसीद यहाँ छपेगी।')}</p>
            </div>
          )}
          {filingError ? (
            <ErrorState
              title={t('This answer could not be filed.', 'यह जवाब फ़ाइल नहीं हो सका।')}
              detail={t('The file changed in another tab. Deal again to carry on.', 'फ़ाइल दूसरे टैब में बदली। फिर से बाँटो।')}
              onRetry={() => {
                setFilingError(false);
                setDraft(null);
              }}
            />
          ) : null}
          {answer && canFold ? (
            <div className="h-route__fold">
              {confirmFold ? (
                <div className="h-route__confirm" role="group" aria-label={t('Start this file over?', 'फ़ाइल फिर से शुरू करें?')}>
                  <p>
                    {t(
                      'Start over? Your receipts stay filed; this run’s score is dropped. One fresh start per file per day.',
                      'फिर से शुरू? रसीदें रहेंगी; इस राउंड का स्कोर हटेगा। हर फ़ाइल दिन में एक बार।',
                    )}
                  </p>
                  <div className="h-route__confirmrow">
                    <Button variant="paper" size="s" icon={<RotateCcw size={18} />} onClick={() => void startOver()} busy={busy}>
                      {t('Start over', 'फिर से शुरू')}
                    </Button>
                    <Button variant="ghost" size="s" onClick={() => setConfirmFold(false)}>
                      {t('Keep going', 'जारी रखो')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="s"
                  onClick={() => {
                    setConfirmFold(true);
                    // The question sits above the sticky Next bar: bring it (and its buttons) into view.
                    requestAnimationFrame(() => {
                      const box = document.querySelector<HTMLElement>('.h-route__confirm');
                      box?.scrollIntoView({ block: 'nearest' });
                      box?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
                    });
                  }}
                >
                  {t('Start this file over', 'यह फ़ाइल फिर से शुरू करो')}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {answer ? (
        <PlayBar>
          <Button variant="primary" block onClick={() => void next()} busy={busy} disabled={!stored}>
            {cursor === RUN_CARDS - 1 ? t('Close the file', 'फ़ाइल बंद करो') : t('Next card', 'अगला कार्ड')}
          </Button>
        </PlayBar>
      ) : null}
    </Page>
  );
}
