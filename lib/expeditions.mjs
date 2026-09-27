// Public route metadata and device-local solo rules. No live duel answers belong here.
import { TIMED_ANSWER_XP } from './edition-rules.mjs';
import { DAY_RE, dayKey } from './journal.mjs';
import { enabledOnly } from './content.mjs';
// The route catalogue is data in its own module so an edition can alias it; every rule stays here.
import { EXPEDITIONS } from './expedition-routes.mjs';
export { EXPEDITIONS };
// A proper scoring rule: expected run score is maximised by calling your true confidence, with
// indifference at exactly p = 1/2 (Steady/Bold) and p = 2/3 (Bold/Called). Steady and Bold payouts
// are byte-identical to the two-tier table so every score ever written stays meaningful.
export const CONFIDENCE = Object.freeze({
  steady: { name: 'Steady', correct: 2, wrong: 0, order: 0 },
  bold: { name: 'Bold', correct: 3, wrong: -1, order: 1 },
  called: { name: 'Called', correct: 4, wrong: -3, order: 2 },
});
// Key order on a frozen object is not a contract; the ladder the switch renders and the tally walks is.
export const CONFIDENCE_ORDER = Object.freeze(['steady', 'bold', 'called']);
// The reachable run-score band, verified by exhaustive enumeration of all 3^6 x 2^6 runs: six Called
// misses floor it at -18, six Called hits ceiling it at 24.
export const MIN_SCORE = -18;
export const MAX_SCORE = 24;
export const expeditionById = (id) => EXPEDITIONS.find((r) => r.id === id);
/**
 * The routes a player can see and start. `EXPEDITIONS` stays the full list because profiles hold
 * journeys keyed by route (`physics:1`) that must keep round-tripping; only presentation and entry
 * consult this one.
 */
export const ACTIVE_EXPEDITIONS = Object.freeze(enabledOnly(EXPEDITIONS));
export const activeExpeditionById = (id) => ACTIVE_EXPEDITIONS.find((r) => r.id === id);
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
const boundedText = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
const date = (n) => Number.isFinite(n) && n >= 0 && n <= 8.64e15;
export function validExpeditionCards(cards, route) {
  return (
    !!route &&
    Array.isArray(cards) &&
    cards.length === 6 &&
    cards.every(
      (f, i) =>
        f &&
        f.factId === route.ids[i] &&
        // A route may declare `topics` to mix several (an edition's state routes do); JHK's routes do not,
        // so for them this is exactly `f.topic === route.topic`.
        (Array.isArray(route.topics) ? route.topics.includes(f.topic) : f.topic === route.topic) &&
        f.domain === route.domain &&
        Number.isInteger(f.correctIndex) &&
        f.correctIndex >= 0 &&
        f.correctIndex < 4 &&
        Array.isArray(f.options) &&
        f.options.length === 4 &&
        new Set(f.options).size === 4 &&
        f.options.every((s) => boundedText(s, 500)) &&
        boundedText(f.question, 1500) &&
        boundedText(f.explanation, 4000) &&
        boundedText(f.subtopic, 200) &&
        boundedText(f.sourceLabel, 300) &&
        boundedText(f.sourceUrl, 2000) &&
        /^https:\/\//.test(f.sourceUrl),
    )
  );
}
export function runResult(run) {
  let score = 0,
    correct = 0,
    bold = 0;
  run.answers.forEach((a, i) => {
    const hit = a.choice === run.cards[i].correctIndex;
    correct += Number(hit);
    bold += Number(a.confidence === 'bold');
    score += CONFIDENCE[a.confidence][hit ? 'correct' : 'wrong'];
  });
  return { score, correct, bold };
}
/** Per-tier { n, correct } counts for the answers placed so far. Never mutates the run. */
export function runTally(run) {
  const t = { steady: { n: 0, correct: 0 }, bold: { n: 0, correct: 0 }, called: { n: 0, correct: 0 } };
  run.answers.forEach((a, i) => {
    const hit = a.choice === run.cards[i].correctIndex;
    t[a.confidence].n += 1;
    if (hit) t[a.confidence].correct += 1;
  });
  return t;
}
function validRun(run, route) {
  return (
    run &&
    validId(run.id) &&
    date(run.startedAt) &&
    validExpeditionCards(run.cards, route) &&
    Number.isInteger(run.cursor) &&
    run.cursor >= 0 &&
    run.cursor <= 6 &&
    Array.isArray(run.answers) &&
    [run.cursor, Math.min(6, run.cursor + 1)].includes(run.answers.length) &&
    run.answers.every(
      (a) =>
        a &&
        Number.isInteger(a.choice) &&
        a.choice >= 0 &&
        a.choice < 4 &&
        Object.hasOwn(CONFIDENCE, a.confidence),
    )
  );
}
function validTally(t) {
  return (
    !!t &&
    CONFIDENCE_ORDER.every((k) => {
      const v = t[k];
      return (
        v &&
        Number.isInteger(v.n) &&
        v.n >= 0 &&
        v.n <= 6 &&
        Number.isInteger(v.correct) &&
        v.correct >= 0 &&
        v.correct <= v.n
      );
    })
  );
}
const sameTally = (a, b) => CONFIDENCE_ORDER.every((k) => a[k].n === b[k].n && a[k].correct === b[k].correct);
function validResult(r) {
  if (!r || !validId(r.runId) || !date(r.at)) return false;
  if (![r.score, r.correct, r.bold].every(Number.isInteger)) return false;
  if (r.correct < 0 || r.correct > 6 || r.bold < 0 || r.bold > 6) return false;
  // Three tiers have no inverse algebra, so a result written since the Called tier landed carries its
  // own tally and is checked by recomputing the score from it. A stakes block that fails or contradicts
  // the scalars invalidates the whole result: stripping or repairing it would let a hand-edited blob
  // keep a score the cards never produced.
  if (r.stakes !== undefined) {
    if (!validTally(r.stakes)) return false;
    const t = r.stakes;
    const n = t.steady.n + t.bold.n + t.called.n;
    const correct = t.steady.correct + t.bold.correct + t.called.correct;
    const score =
      2 * t.steady.correct +
      (3 * t.bold.correct - (t.bold.n - t.bold.correct)) +
      (4 * t.called.correct - 3 * (t.called.n - t.called.correct));
    return n === 6 && correct === r.correct && t.bold.n === r.bold && score === r.score;
  }
  // Results written before the Called tier: the two-tier bounds and algebra, unchanged.
  if (r.score < -6 || r.score > 18) return false;
  // score = 2*correct + 2*boldCorrect - bold. Reject impossible combinations.
  const boldCorrect = (r.score - 2 * r.correct + r.bold) / 2;
  return (
    Number.isInteger(boldCorrect) &&
    boldCorrect >= Math.max(0, r.correct + r.bold - 6) &&
    boldCorrect <= Math.min(r.correct, r.bold)
  );
}
// Correctness first, score as the tiebreak: the 5/6 and 6/6 score bands overlap by eight points under
// three tiers, so raw score would let a 5/6 run outrank the player's own flawless one. It is also the
// only comparison that means the same thing across results scored on the old and new tables.
const better = (a, b) => !b || a.correct > b.correct || (a.correct === b.correct && a.score > b.score);
export function readExpeditions(value) {
  const result = {};
  for (const route of EXPEDITIONS) {
    const record = value?.[route.key];
    if (!record || typeof record !== 'object') continue;
    let run = validRun(record.run, route) ? record.run : null;
    const first = validResult(record.first) ? record.first : null,
      last = first && validResult(record.last) ? record.last : first;
    const baseline = first && better(last, first) ? last : first;
    const best = first && validResult(record.best) && !better(baseline, record.best) ? record.best : baseline;
    if (run?.cursor === 6) {
      const result = runResult(run);
      if (
        !first ||
        !last ||
        last.runId !== run.id ||
        ['score', 'correct', 'bold'].some((k) => last[k] !== result[k]) ||
        (last.stakes !== undefined && !sameTally(last.stakes, runTally(run)))
      )
        run = null;
    }
    if (!run && !first) continue;
    result[route.key] = {
      run,
      first,
      best,
      last,
      completions:
        first && Number.isSafeInteger(record.completions) && record.completions > 0
          ? Math.min(1000000, record.completions)
          : first
            ? 1
            : 0,
      // Rebuilt from whatever the blob can prove, so a profile written before the field existed
      // does not hand a fresh floor of zero to a route it has already scored above.
      bestScore: !first
        ? null
        : Number.isInteger(record.bestScore) && record.bestScore >= MIN_SCORE && record.bestScore <= MAX_SCORE
          ? Math.max(record.bestScore, first.score, last?.score ?? MIN_SCORE)
          : Math.max(first.score, last?.score ?? MIN_SCORE, best?.score ?? MIN_SCORE),
      folded: !!run && record.folded === true,
      // RegExp.test string-coerces, so without the typeof guard an array of one valid day passes
      // and then never matches the strict comparison the fold cap makes against it.
      foldedDay:
        typeof record.foldedDay === 'string' && DAY_RE.test(record.foldedDay) ? record.foldedDay : null,
    };
  }
  return result;
}
export function expeditionStatus(record) {
  if (record?.run && record.run.cursor < 6 && !record.folded) return 'continue';
  return record?.first ? 'complete' : 'new';
}
export function reduceExpeditions(state, action) {
  const route = expeditionById(action.routeId);
  if (!route) return state;
  const record = state[route.key] || {
      run: null,
      first: null,
      best: null,
      last: null,
      bestScore: null,
      completions: 0,
      folded: false,
      foldedDay: null,
    },
    run = record.run;
  if (action.type === 'journey-start') {
    if (
      !validId(action.runId) ||
      !date(action.at) ||
      !validExpeditionCards(action.cards, route) ||
      (run?.id ?? null) !== (action.previousRunId ?? null) ||
      (run && run.cursor < 6 && !record.folded) ||
      run?.id === action.runId
    )
      return state;
    return {
      ...state,
      [route.key]: {
        // Spelt out rather than left to the spread: carrying folded: true into the fresh run would make
        // it unresumable and silently foldable again. foldedDay is the day cap and must survive.
        ...record,
        folded: false,
        run: { id: action.runId, cards: action.cards, startedAt: action.at, cursor: 0, answers: [] },
      },
    };
  }
  if (action.type === 'journey-fold') {
    // journey-start's refusal to replace a partial run is what stops an answer-one-card-and-restart
    // farm; folding lifts it, so the fold itself is capped at one per route per local day.
    if (!run || run.id !== action.runId || run.cursor === 6 || run.answers.length < 1 || !date(action.at))
      return state;
    const day = dayKey(action.at);
    if (record.foldedDay === day) return state;
    return { ...state, [route.key]: { ...record, folded: true, foldedDay: day } };
  }
  // A folded run is over. Without this, `journey-answer` and `journey-next` keep advancing it behind
  // the status function's back, and a folded route still banks a stamp and a completion.
  if (record.folded) return state;
  if (!run || run.id !== action.runId || run.cursor === 6 || action.index !== run.cursor) return state;
  if (action.type === 'journey-answer') {
    if (
      run.answers.length !== run.cursor ||
      !Number.isInteger(action.choice) ||
      action.choice < 0 ||
      action.choice > 3 ||
      !(TIMED_ANSWER_XP || Object.hasOwn(CONFIDENCE, action.confidence))
    )
      return state;
    return {
      ...state,
      [route.key]: {
        ...record,
        run: { ...run, answers: [...run.answers, { choice: action.choice, confidence: TIMED_ANSWER_XP ? 'steady' : action.confidence, ...(TIMED_ANSWER_XP ? { elapsedMs: Number.isFinite(action.elapsedMs) && action.elapsedMs >= 0 ? action.elapsedMs : null } : {}) }] },
      },
    };
  }
  if (action.type === 'journey-next') {
    if (run.answers.length !== run.cursor + 1 || !date(action.at)) return state;
    const updated = { ...run, cursor: run.cursor + 1 };
    if (updated.cursor < 6) return { ...state, [route.key]: { ...record, run: updated } };
    const result = { runId: run.id, ...runResult(updated), at: action.at, stakes: runTally(updated) };
    return {
      ...state,
      [route.key]: {
        // A fresh literal, not a spread: every field readExpeditions rebuilds has to be written here or
        // it disappears on the next load.
        run: updated,
        first: record.first || result,
        best: better(result, record.best) ? result : record.best,
        // `best` is ordered by correctness first (R3), so it is NOT a score high-water mark: a 5/6
        // at 20 never displaces a 6/6 at 12. The replay XP floor needs the mark itself, or a player
        // who memorises a route and then deliberately drops one card is paid the same "improvement"
        // on every single replay, for ever.
        bestScore: Math.max(record.bestScore ?? MIN_SCORE, result.score),
        last: result,
        completions: Math.min(1000000, record.completions + 1),
        folded: false,
        foldedDay: record.foldedDay ?? null,
      },
    };
  }
  return state;
}
