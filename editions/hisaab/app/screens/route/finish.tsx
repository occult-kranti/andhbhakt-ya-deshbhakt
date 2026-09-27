/**
 * screens/route/finish.tsx — the route finish (design bible §11.13; §9 notification budget; §10 FILE PILE).
 *
 * FILE PILE (three/<FilePile>, 2D fallback until the three lane plugs its scene in) with the THAPPA
 * stamp FILE CLEARED · score/24 → the score and best (a replay updates in place: "Best: 14 → 18") →
 * the calibration line → the XP the run paid (read back from the progression log) → Next file (the
 * one violet primary: a neighbouring tile, the next sector…) with "Choose another" and "Replay" →
 * the six mini receipts ("Share this file").
 *
 * The `file` ceremony opens ONLY on the first clear of a state / sector / Kiska Media? / Forward
 * Court file, raised once from here (the shell's watcher merges a label promotion into it). Replays
 * and money-trail or year files update in place and log to Activity.
 */
import { useEffect, useMemo, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Route } from '../../../edition';
import { useBudget } from '../../budget';
import { formatNumber, itemForCard } from '../../data';
import { href } from '../../router';
import { FilePile, filePileStamp, type FileResult } from '../../three';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { CompletionAdBreak } from '../../ads/completion-ad-break';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { ReceiptStrip, type MiniEntry } from './receipt-strip';
import {
  CEREMONY_KINDS,
  fileNo,
  hubHref,
  journeyRoundId,
  MAX_RUN_SCORE,
  nextFile,
  roundsById,
  routeTitleHi,
  signed,
  xpAt,
  xpForRound,
  type Journal,
  type JourneyRecord,
  type Journeys,
  type Progression,
  type Run,
} from './lib';
import './finish.css';

export type RouteFinishProps = {
  route: Route;
  record: JourneyRecord;
  run: Run;
  journeys: Journeys;
  journal: Journal;
  progression: Progression;
  /** Set when the run was finished in this visit (the ceremony / in-place best note fire once). */
  justFinished: { runId: string; wasFirst: boolean; prevBest: number | null } | null;
};

export function RouteFinish({ route, record, run, journeys, journal, progression, justFinished }: RouteFinishProps) {
  const { t, isHi } = useLang();
  const budget = useBudget();
  const titleHi = routeTitleHi(route);

  const results: FileResult[] = run.cards.map((c, i) => (run.answers[i]?.choice === c.correctIndex ? 'pass' : 'fail'));
  const correct = results.filter((r) => r === 'pass').length;
  const score = run.answers.reduce((s, a, i) => s + Number(a.choice === run.cards[i]?.correctIndex), 0);
  const best = record.best?.correct ?? score;

  // XP: every log line written by this run's six answers and its finish. Shown only when the log still
  // holds all of it (it keeps the last 40 lines) — never a partial sum.
  const xp = useMemo(() => {
    const rounds = roundsById(journal);
    const log = progression?.log;
    const cards = run.cards.map((_, i) => xpForRound(rounds, log, journeyRoundId(run.id, i)));
    const last = record.last && record.last.runId === run.id ? xpAt(log, record.last.at) : null;
    if (cards.some((c) => !c) || !last) return null;
    const cardXp = cards.reduce((s, c) => s + (c?.xp ?? 0), 0);
    return { total: cardXp + last.xp, cards: cardXp, finish: last.xp, note: last.note };
  }, [journal, progression?.log, record.last, run]);

  const firstClear = !!justFinished?.wasFirst;
  const improved = !!justFinished && !justFinished.wasFirst && justFinished.prevBest !== null && score > justFinished.prevBest;

  // The one ceremony (first clear of a records-room file) or an in-place note — once per finish.
  const raised = useRef(false);
  useEffect(() => {
    if (raised.current || !justFinished) return;
    raised.current = true;
    if (justFinished.wasFirst && CEREMONY_KINDS.has(route.kind)) {
      budget.ceremony({
        kind: 'file',
        kicker: t('File cleared', 'फ़ाइल क्लियर'),
        title: t(`${route.title} ki file clear.`, `${titleHi ?? route.title} की फ़ाइल क्लियर।`),
        titleHi,
        subtitle: t('Feeta khul gaya.', 'फ़ीता खुल गया।'),
        stamp: filePileStamp({ got: score, max: MAX_RUN_SCORE }),
        seed: route.id,
        continueLabel: t('Continue', 'आगे'),
      });
    } else if (justFinished.wasFirst) {
      budget.note(`File cleared: ${route.title}`, `${correct}/6 · ${signed(score)} ${Math.abs(score) === 1 ? 'pt' : 'pts'}`);
    } else if (improved && justFinished.prevBest !== null) {
      budget.note(`Best: ${signed(justFinished.prevBest)} → ${signed(score)}`, route.title);
    }
  }, [justFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestion = nextFile(route, journeys);
  const minis: MiniEntry[] = run.cards.map((card, i) => ({
    card,
    item: itemForCard(card),
    right: run.answers[i] ? run.answers[i].choice === card.correctIndex : null,
  }));
  const calib = t('Accuracy is your file score. Stopwatch XP is awarded separately; a correct answer always counts.', 'सही जवाब फ़ाइल स्कोर है। स्टॉपवॉच XP अलग मिलता है; हर सही जवाब गिना जाता है।');

  return (
    <Page screen="route-finish" className="h-finish">
      <CompletionAdBreak completionId={`file:${run.id}`} kind="practice" />
      <ScreenHeader
        kicker={`${fileNo(route)} · ${t('CLEARED', 'क्लियर')}`}
        titleHi={titleHi}
        title={route.title}
        lead={t(`${route.title} ki file clear. Feeta khul gaya.`, `${titleHi ?? route.title} की फ़ाइल क्लियर। फ़ीता खुल गया।`)}
      />
      <div className="h-finish__grid">
        <div className="h-finish__scene h-stamp-stage">
          <FilePile results={results} title={route.title} score={{ got: score, max: MAX_RUN_SCORE }} height={260} />
        </div>
        <div className="h-finish__summary">
          <dl className="h-finish__facts">
            <div className="h-finish__fact">
              <dt>{t('Right', 'सही')}</dt>
              <dd className="h-mono">
                {correct}/{run.cards.length}
              </dd>
            </div>
            <div className="h-finish__fact">
              <dt>{t('Correct answers', 'सही जवाब')}</dt>
              <dd className="h-mono">
                {signed(score)}
                <span className="h-finish__of">/{MAX_RUN_SCORE}</span>
              </dd>
            </div>
            {xp ? (
              <div className="h-finish__fact h-finish__fact--xp">
                <dt>XP</dt>
                <dd className="h-mono">+{formatNumber(xp.total)}</dd>
              </div>
            ) : null}
          </dl>
          <p className="h-finish__best" aria-live="polite">
            {firstClear ? (
              <>
                <Chip kind="plain">{t('FIRST CLEAR', 'पहली बार क्लियर')}</Chip>{' '}
                {t(`Best: ${signed(score)}.`, `सबसे अच्छा: ${signed(score)}।`)}
              </>
            ) : improved && justFinished?.prevBest !== null && justFinished ? (
              <>{t(`Best: ${signed(justFinished.prevBest!)} → ${signed(score)}`, `सबसे अच्छा: ${signed(justFinished.prevBest!)} → ${signed(score)}`)}</>
            ) : (
              <>
                {t(`Best: ${signed(best)}`, `सबसे अच्छा: ${signed(best)}`)}
                {best !== score ? t(` · this run ${signed(score)}`, ` · इस बार ${signed(score)}`) : ''}
                {record.completions > 1 ? t(` · cleared ${record.completions} times`, ` · ${record.completions} बार क्लियर`) : ''}
              </>
            )}
          </p>
          {calib ? <p className="h-finish__calib">{calib}</p> : null}
          {xp ? (
            <p className="h-finish__xp">
              {t(`Cards +${formatNumber(xp.cards)} · finish +${formatNumber(xp.finish)}`, `कार्ड +${formatNumber(xp.cards)} · फ़ाइल +${formatNumber(xp.finish)}`)}
              <span className="h-finish__xpnote"> ({xp.note})</span>
            </p>
          ) : null}
          {route.padded.length ? <p className="h-finish__padded">{route.subtitle}</p> : null}
          <div className="h-finish__actions">
            {suggestion ? (
              <Button variant="primary" block href={href.route(suggestion.id)}>
                {t(`Next file: ${suggestion.title}`, `अगली फ़ाइल: ${routeTitleHi(suggestion) ?? suggestion.title}`)}
              </Button>
            ) : (
              <Button variant="primary" block href={hubHref(route)}>
                {t('Choose another file', 'दूसरी फ़ाइल चुनो')}
              </Button>
            )}
            <div className="h-finish__row">
              {suggestion ? (
                <Button variant="ghost" size="s" href={hubHref(route)}>
                  {t('Choose another', 'दूसरी चुनो')}
                </Button>
              ) : null}
              <Button variant="paper" size="s" href={href.route(route.id)} icon={<RotateCcw size={18} />}>
                {t('Replay this file', 'यह फ़ाइल दोबारा')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ReceiptStrip
        entries={minis}
        title={t('Share this file', 'यह फ़ाइल भेजो')}
        lead={t('Six receipts. Forward any of them — each carries its source and status.', 'छह रसीदें। कोई भी भेजो — हर एक के साथ सोर्स और स्टेटस।')}
        share="receipt"
      />
    </Page>
  );
}
