// Client-local progression: XP, levels, streaks, daily quests, achievements, arena rank and cosmetics.
// Pure and I/O-free like lib/expeditions.mjs. XP is only ever earned from typed events that
// deriveEvents() reads out of a before/after profile diff, so re-polled room snapshots, replayed
// expeditions and repeated open/recall toggles can never award twice. Same honesty stance as the
// README: this is an editable device-local record with no monetary value, never a trusted rank.
//
// There is no currency in this module. Version 1 records carried a second currency (a `wallet`
// with `gems` / `lifetimeGems`, priced cosmetics and a `cosmetic-buy` action); the coin economy in
// lib/economy is the only currency now, and cosmetics are unlocked by play (level, badge, rank or
// conviction) and never priced. readProgression accepts a version 1 record and migrates it: the
// wallet is dropped, every cosmetic the player had already bought stays owned, and the equipped set
// is kept. That migration comment is the one place the old word appears in this file.
import { TIMED_ANSWER_XP } from './edition-rules.mjs';
import { TOPIC_DOMAINS, DIFFICULTIES, DAY_RE, dayKey, dayDiff } from './journal.mjs';
import { CONFIDENCE, CONFIDENCE_ORDER, expeditionById } from './expeditions.mjs';
export const PROGRESSION_VERSION = 2;
/** Stored record versions readProgression accepts. Anything else yields the empty record. */
const READABLE_VERSIONS = Object.freeze([1, PROGRESSION_VERSION]);
export const TOPICS = Object.freeze(Object.keys(TOPIC_DOMAINS));
export const MODES = Object.freeze(['quick', 'trilogy', 'gauntlet']);
export const MODE_NAMES = Object.freeze({
  quick: 'Quick Draw',
  trilogy: 'Triple Threat',
  gauntlet: 'The Gauntlet',
});
export const DIFFICULTY_MULTIPLIER = Object.freeze({ simple: 1, expert: 1.3, extreme: 1.6 });
export const LOG_LIMIT = 40;
// Every tunable in one place so the UI can quote the same numbers the reducer uses.
export const XP = Object.freeze({
  roundCorrectBot: 20,
  roundCorrectHuman: 30,
  roundWrong: 5,
  speedFast: 15, // correct under 2000 ms
  speedQuick: 8, // correct under 4000 ms
  matchWin: Object.freeze({ quick: 50, trilogy: 80, gauntlet: 120 }),
  matchLoss: 15,
  matchDraw: 25,
  humanMultiplier: 1.5,
  perfectGauntlet: 100,
  // Per-card XP is identical at every confidence tier (R2). An affine XP/score table that keeps the
  // tier crossovers honest forces a confident miss to pay less than a cautious one, so the bet lives
  // entirely in run score and the XP channel stays indifferent to the tier chosen.
  expeditionCorrect: 12,
  expeditionWrong: 3,
  // R1: only a fact's first expedition answer pays in full. A replay is still worth playing and is
  // worth nothing to farm.
  expeditionRepeat: 4,
  // Deliberately below the expedition rate, and paid only on a due attempt that moved the schedule,
  // so the Recall Lab pays for learning without becoming the cheapest XP in the game.
  reviewCorrect: 6,
  review: 3,
  // Finishing is worth less than playing well: a six-card route answered wrongly throughout must
  // not out-earn a Gauntlet win. Most of the reward rides on the run score (max 24).
  expeditionComplete: 40,
  expeditionScorePoint: 8,
  expeditionStamp: 60,
  fact: 10,
  open: 5,
  recall: 5,
  save: 4,
  discovery: 8,
  discoveryCorrect: 12,
  questBonus: 100,
  // Flat bonus for clearing a limited-time event mode, scaled by that mode's xpBonus multiplier.
  eventMode: 40,
  streakPerDay: 10,
  streakCap: 7,
  rankWin: Object.freeze({ quick: 20, trilogy: 30, gauntlet: 40 }),
  rankLoss: -10,
  rankDraw: 5,
});
// ---------------------------------------------------------------------------------------------
// Level curve
export const LEVEL_TITLES = Object.freeze([
  'Rookie',
  'Contender',
  'Challenger',
  'Scholar',
  'Strategist',
  'Sage',
  'Virtuoso',
  'Oracle',
  'Legend',
]);
/** XP needed to go from `level` to `level + 1`: round(80 * level^1.55). */
export function xpToNext(level) {
  return Math.round(80 * Math.pow(Math.max(1, Math.floor(level)), 1.55));
}
/** Cumulative XP at which `level` begins (level 1 = 0). */
export function xpForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}
/** Level, XP into it, XP still needed, 0..1 progress, band title and band index for an XP total. */
export function levelForXp(xp) {
  let level = 1,
    into = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  while (into >= xpToNext(level)) {
    into -= xpToNext(level);
    level += 1;
  }
  const toNext = xpToNext(level),
    band = Math.min(LEVEL_TITLES.length - 1, Math.floor(level / 5)); // Rookie 1-4, Contender 5-9, ... Legend 40+
  return { level, into, toNext, progress: into / toNext, title: LEVEL_TITLES[band], band };
}
/** In-match multiplier for `combo` consecutive correct rounds (1 for a single correct answer). */
export function comboMultiplier(combo) {
  return combo >= 5 ? 2 : combo === 4 ? 1.75 : combo === 3 ? 1.5 : combo === 2 ? 1.25 : 1;
}
// ---------------------------------------------------------------------------------------------
// Days, hashing and the deterministic PRNG behind daily quests / wild rounds
// dayKey/dayDiff now live in lib/journal.mjs, which imports nothing, so lib/expeditions.mjs can day-key
// a fold without importing this module back. Re-exported verbatim so every existing import site stands.
export { dayKey, dayDiff };
export function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Variable-ratio bonus for a duel round id: x3 about 1 in 36, x2 about 1 in 6, otherwise x1. */
export function wildRound(roundId) {
  const h = fnv1a32(String(roundId));
  return h % 36 === 1 ? 3 : h % 6 === 0 ? 2 : 1;
}
// ---------------------------------------------------------------------------------------------
// Arena rank
export const RANK_TIERS = Object.freeze(
  [
    { id: 'bronze', label: 'Bronze', min: 0 },
    { id: 'silver', label: 'Silver', min: 100 },
    { id: 'gold', label: 'Gold', min: 250 },
    { id: 'platinum', label: 'Platinum', min: 500 },
    { id: 'diamond', label: 'Diamond', min: 900 },
  ].map(Object.freeze),
);
const rankIndex = (id) =>
  Math.max(
    0,
    RANK_TIERS.findIndex((t) => t.id === id),
  );
/** Tier for a points total, with progress towards the next tier (progress 1 at the top tier). */
export function rankForPoints(points) {
  const p = Number.isFinite(points) && points > 0 ? Math.floor(points) : 0;
  const i = RANK_TIERS.reduce((best, t, j) => (p >= t.min ? j : best), 0);
  const tier = RANK_TIERS[i],
    next = RANK_TIERS[i + 1] ?? null;
  const into = p - tier.min,
    toNext = next ? next.min - tier.min : 0;
  return {
    tier: tier.id,
    label: tier.label,
    into,
    toNext,
    progress: next ? into / toNext : 1,
  };
}
// ---------------------------------------------------------------------------------------------
// Conviction: a calibration badge minted on this device from this device's own expedition calls. It is
// never a comparison against other players — the cohort payload carries no correctness at all — and it
// is derived from the six tallies on every read, the way levelForXp derives from xp, so a hand-edited
// tally can never leave a stored rating standing beside numbers that do not produce it.
export const CONVICTION_TIERS = Object.freeze(
  [
    { id: 'provisional', label: 'Provisional', min: -Infinity },
    { id: 'hunch', label: 'Hunch', min: 0 },
    { id: 'read', label: 'Read', min: 1150 },
    { id: 'edge', label: 'Edge', min: 1300 },
    { id: 'sharp', label: 'Sharp', min: 1500 },
    { id: 'deadeye', label: 'Dead eye', min: 1700 },
  ].map(Object.freeze),
);
// Tier initial + landed flag; 'c1' is a Called card that landed. Drives the brain hero and nothing else.
export const CONVICTION_CODES = Object.freeze(['s0', 's1', 'b0', 'b1', 'c0', 'c1']);
export const CONVICTION_WINDOW = 20;
export const CONVICTION_COUNTED_LIMIT = 1200; // mirrors FACT_LIMIT; the bank is 54 facts today
export const CONVICTION_MIN_CARDS = 30; // distinct facts first met in an expedition (R1)
export const CONVICTION_MIN_CALLS = 20; // of those, how many were called above Steady
export const convictionIndex = (id) =>
  Math.max(
    0,
    CONVICTION_TIERS.findIndex((t) => t.id === id),
  );
/** Total run points those calls actually scored, using CONFIDENCE's own table. */
export function convictionPoints(c) {
  return (
    2 * c.steady.correct +
    (3 * c.bold.correct - (c.bold.n - c.bold.correct)) +
    (4 * c.called.correct - 3 * (c.called.n - c.called.correct))
  );
}
/** DISTINCT facts on which a first-encounter expedition call was placed (R1). 0..54 today. */
export function convictionCalls(c) {
  return c.steady.n + c.bold.n + c.called.n;
}
/** Distinct facts called above Steady. The second gate, and the headline fraction's denominator. */
export function convictionRiskCalls(c) {
  return c.bold.n + c.called.n;
}
/** Distinct calls above Steady that landed. */
export function convictionRiskLanded(c) {
  return c.bold.correct + c.called.correct;
}
/** 1000 + 200 x mean run points per called card, clamped 0..2000. 1000 when nothing is called yet. */
export function convictionRating(c) {
  const n = convictionCalls(c);
  if (!n) return 1000;
  return Math.max(0, Math.min(2000, Math.round(1000 + 200 * (convictionPoints(c) / n))));
}
/**
 * Mean points per card is itself a proper scoring rule, so the badge ties exactly where expected run
 * score ties and only miscalibrated over-calling drags it down. Steady sits in the denominator on
 * purpose: excluding it would make declining free and measure risk appetite instead of calibration.
 */
export function convictionTier(c) {
  if (convictionCalls(c) < CONVICTION_MIN_CARDS) return CONVICTION_TIERS[0];
  const rating = convictionRating(c);
  const i = CONVICTION_TIERS.reduce((best, t, j) => (rating >= t.min ? j : best), 1);
  // An all-Steady player's rating maxes at 1400, which is Edge: a badge, a title and a banner for
  // someone who has never made a call. Everything above Hunch needs calls that were actually at risk.
  if (convictionRiskCalls(c) < CONVICTION_MIN_CALLS) return CONVICTION_TIERS[Math.min(i, 1)];
  return CONVICTION_TIERS[i];
}
// ---------------------------------------------------------------------------------------------
// Daily quests
const correctAnswer = (e) =>
  (e.kind === 'round' || e.kind === 'discovery' || e.kind === 'expedition-answer') && e.correct;
const won = (e) => e.kind === 'match' && e.outcome === 'win';
const quest = (id, tier, label, target, source, advances, pick) =>
  Object.freeze({
    id,
    tier,
    label,
    target,
    xp: { easy: 30, medium: 50, hard: 80 }[tier],
    source,
    advances,
    ...(pick ? { pick } : {}),
  });
export const QUEST_TEMPLATES = Object.freeze([
  quest('answer-3', 'easy', 'Answer 3 questions correctly', 3, 'correct answer', correctAnswer),
  quest('open-2', 'easy', 'Open 2 explanations', 2, 'first open of a fact', (e) => e.kind === 'open'),
  quest('save-2', 'easy', 'Save 2 facts to your Vault', 2, 'save to vault', (e) => e.kind === 'save'),
  quest('discovery-1', 'easy', 'Try a Discovery card', 1, 'discovery attempt', (e) => e.kind === 'discovery'),
  quest('play-1', 'easy', 'Play any duel', 1, 'finished duel', (e) => e.kind === 'match'),
  quest(
    'expedition-cards-2',
    'easy',
    'Answer 2 expedition cards',
    2,
    'expedition answer',
    (e) => e.kind === 'expedition-answer',
  ),
  quest('win-2', 'medium', 'Win 2 duels', 2, 'duel win', won),
  quest(
    'topic-play',
    'medium',
    'Play a {topic} duel',
    1,
    'finished duel on the topic',
    (e, item) => e.kind === 'match' && (e.topic === item.topic || e.topics.includes(item.topic)),
    'topic',
  ),
  quest(
    'mode-play',
    'medium',
    'Play {mode}',
    1,
    'finished duel in the mode',
    (e, item) => e.kind === 'match' && e.mode === item.mode,
    'mode',
  ),
  quest(
    'combo-3',
    'medium',
    'Get a 3-answer combo in one match',
    1,
    'round with combo >= 3',
    (e) => e.kind === 'round' && e.combo >= 3,
  ),
  quest(
    'expedition-finish-1',
    'medium',
    'Finish an expedition',
    1,
    'expedition completion',
    (e) => e.kind === 'expedition-complete',
  ),
  quest('correct-6', 'medium', 'Answer 6 correctly', 6, 'correct answer', correctAnswer),
  quest(
    'review-5',
    'medium',
    'Clear 5 cards from your review queue',
    5,
    'due review answered',
    (e) => e.kind === 'review' && e.due,
  ),
  quest(
    'win-gauntlet',
    'hard',
    'Win The Gauntlet',
    1,
    'gauntlet win',
    (e) => won(e) && e.mode === 'gauntlet',
  ),
  quest('win-3', 'hard', 'Win 3 duels', 3, 'duel win', won),
  quest(
    'speed-2',
    'hard',
    'Answer 2 correctly under 3 seconds',
    2,
    'correct duel round under 3000 ms',
    (e) => e.kind === 'round' && e.correct && e.elapsedMs !== null && e.elapsedMs < 3000,
  ),
  // Same id, tier and target as the quest it replaces so the daily seed sequence is untouched. It no
  // longer names a tier: paying a daily deadline for choosing a bigger stake is direct pressure to
  // over-call, and over-calling is exactly the miscalibration the Conviction badge beside it penalises.
  quest(
    'bold-4',
    'hard',
    'Answer 4 expedition cards correctly',
    4,
    'correct expedition answer',
    (e) => e.kind === 'expedition-answer' && e.correct,
  ),
  quest(
    'human-1',
    'hard',
    'Duel a friend',
    1,
    'finished duel vs a human',
    (e) => e.kind === 'match' && !e.bot,
  ),
  quest(
    'perfect-trilogy',
    'hard',
    'Win Triple Threat 2-0',
    1,
    'trilogy win 2-0',
    (e) => won(e) && e.mode === 'trilogy' && e.scores[0] === 2 && e.scores[1] === 0,
  ),
]);
const questTemplate = (id) => QUEST_TEMPLATES.find((t) => t.id === id);
const questLabel = (t, item) =>
  t.label.replace('{topic}', item.topic ?? '').replace('{mode}', MODE_NAMES[item.mode] ?? '');
/** The three quests (easy, medium, hard) for a profile epoch on a day; deterministic per seed. */
export function dailyQuests(epoch, day) {
  const seed = `${epoch}:${day}`,
    rng = mulberry32(fnv1a32(seed));
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const items = ['easy', 'medium', 'hard'].map((tier) => {
    const t = pick(QUEST_TEMPLATES.filter((q) => q.tier === tier));
    const item = {
      id: `${day}:${t.id}`,
      template: t.id,
      label: t.label,
      target: t.target,
      progress: 0,
      xp: t.xp,
      done: false,
      claimedAt: null,
    };
    if (t.pick === 'topic') item.topic = pick(TOPICS);
    if (t.pick === 'mode') item.mode = pick(MODES);
    item.label = questLabel(t, item);
    return item;
  });
  return { day, seed, items };
}
// ---------------------------------------------------------------------------------------------
// Achievements: check(prog, events, ctx) runs after this reduce's counters are applied.
const REWARD = Object.freeze({ bronze: { xp: 50 }, silver: { xp: 120 }, gold: { xp: 300 } });
const domainCorrect = (prog, domain) =>
  TOPICS.filter((t) => TOPIC_DOMAINS[t] === domain).reduce((n, t) => n + prog.counters.byTopic[t].correct, 0);
const nightHour = (h) => h >= 23 || h < 4,
  dawnHour = (h) => h >= 5 && h < 8;
const ach = (id, name, description, tier, check, hidden = false) =>
  Object.freeze({ id, name, description, tier, xp: REWARD[tier].xp, hidden, check });
export const ACHIEVEMENTS = Object.freeze([
  ach('first-duel', 'First duel', 'Finish your first duel.', 'bronze', (p) => p.counters.matches >= 1),
  ach('first-win', 'First win', 'Win a duel.', 'bronze', (p) => p.counters.wins >= 1),
  ach('wins-10', 'Ten up', 'Win 10 duels.', 'bronze', (p) => p.counters.wins >= 10),
  ach('wins-50', 'Half century', 'Win 50 duels.', 'silver', (p) => p.counters.wins >= 50),
  ach('wins-200', 'Double century', 'Win 200 duels.', 'gold', (p) => p.counters.wins >= 200),
  ach('streak-3', 'Three in a row', 'Play three days running.', 'bronze', (p) => p.streak.best >= 3),
  ach('streak-7', 'Full week', 'Play seven days running.', 'silver', (p) => p.streak.best >= 7),
  ach('streak-30', 'Monthly regular', 'Play thirty days running.', 'gold', (p) => p.streak.best >= 30),
  ach(
    'combo-3',
    'Hat-trick',
    'Three correct answers in a row in one match.',
    'bronze',
    (p) => p.counters.bestCombo >= 3,
  ),
  ach(
    'combo-5',
    'Clean sweep',
    'Five correct answers in a row in one match.',
    'silver',
    (p) => p.counters.bestCombo >= 5,
  ),
  ach(
    'speed-demon',
    'Speed demon',
    'A correct answer in under 1.5 seconds.',
    'silver',
    (p) => p.counters.fastestCorrectMs !== null && p.counters.fastestCorrectMs < 1500,
  ),
  ach(
    'perfect-gauntlet',
    'Perfect gauntlet',
    'Win The Gauntlet 5-0.',
    'gold',
    (p) => p.counters.perfectGauntlets >= 1,
  ),
  ach('comeback', 'Comeback', 'Win Triple Threat after losing the first round.', 'silver', (p, events) =>
    events.some((e) => e.kind === 'match' && e.comeback),
  ),
  ach('mode-tour', 'Mode tour', 'Finish all three duel modes.', 'bronze', (p) =>
    MODES.every((m) => p.counters.byMode[m].played >= 1),
  ),
  ach(
    'friend-rival',
    'Friendly rival',
    'Finish a duel against a friend.',
    'bronze',
    (p) => p.counters.humanMatches >= 1,
  ),
  ach(
    'all-routes',
    'Every stamp',
    'Complete all nine expedition routes.',
    'gold',
    (p) => p.counters.stamps >= 9,
  ),
  // Nine of the 6/6 tier splits that score 18 or more contain Steady cards, including three Steady plus
  // three Called, so the score alone cannot make the description true. The fallbacks keep a synthetic
  // event with neither field firing it; every event deriveEvents mints carries both.
  // Retargeted to accuracy. "Nothing below Bold" keyed the award on the tiers the player selected,
  // which §1.7 forbids outright and R2 exists to prevent: a gold award worth 300 XP that
  // a correctly calibrated player forfeits the moment they honestly call one card Steady is a reward
  // for over-calling, whatever the flat XP table does.
  ach('bold-master', 'Clean sweep', 'Finish a route six for six.', 'gold', (p, events) =>
    events.some((e) => e.kind === 'expedition-complete' && (e.correct ?? 6) === 6),
  ),
  ach('scholar-50', 'Scholar', 'Encounter 50 distinct facts.', 'silver', (p) => p.counters.facts >= 50),
  ach('scholar-200', 'Polymath', 'Encounter 200 distinct facts.', 'gold', (p) => p.counters.facts >= 200),
  ach('vault-25', 'Vault keeper', 'Save 25 facts to your Vault.', 'silver', (p) => p.counters.saves >= 25),
  ach('curious-25', 'Curious', 'Open 25 explanations.', 'silver', (p) => p.counters.opens >= 25),
  ach(
    'night-owl',
    'Night owl',
    'Play a duel round between 23:00 and 04:00.',
    'bronze',
    (p, events) => events.some((e) => e.kind === 'round' && nightHour(e.hour)),
    true,
  ),
  ach(
    'early-bird',
    'Early bird',
    'Play a duel round between 05:00 and 08:00.',
    'bronze',
    (p, events) => events.some((e) => e.kind === 'round' && dawnHour(e.hour)),
    true,
  ),
  ach(
    'sports-fan',
    'Sports fan',
    '50 correct answers in sports topics.',
    'silver',
    (p) => domainCorrect(p, 'sports') >= 50,
  ),
  ach(
    'lab-coat',
    'Lab coat',
    '50 correct answers in science topics.',
    'silver',
    (p) => domainCorrect(p, 'science') >= 50,
  ),
  ach(
    'quest-streak-10',
    'Quest regular',
    'Complete 10 daily quests.',
    'silver',
    (p) => p.counters.questsDone >= 10,
  ),
  ach('level-10', 'Level 10', 'Reach level 10.', 'bronze', (p) => levelForXp(p.xp).level >= 10),
  ach('level-25', 'Level 25', 'Reach level 25.', 'silver', (p) => levelForXp(p.xp).level >= 25),
  ach('level-40', 'Level 40', 'Reach level 40.', 'gold', (p) => levelForXp(p.xp).level >= 40),
]);
export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);
// ---------------------------------------------------------------------------------------------
// Cosmetics
export const COSMETIC_KINDS = Object.freeze(['frame', 'title', 'banner', 'accent']);
export const DEFAULT_COSMETICS = Object.freeze({
  frame: 'default',
  title: 'challenger',
  banner: 'midnight',
  accent: 'volt',
});
// `price` is always null and stays on the record so a stored catalogue shape never changes; nothing
// reads it. Every non-default item has exactly one unlock rule: level, achievement, rank or
// conviction. The ladder is paced so that an evening pays the first accent and title, a week of
// daily play pays a frame and a banner, and the rest follow the badges they are named after.
const cos = (kind, id, name, description, unlock = {}) =>
  Object.freeze({ id, kind, name, description, price: null, unlock: Object.freeze(unlock) });
export const COSMETICS = Object.freeze([
  cos('frame', 'default', 'Standard', 'The plain card frame.'),
  cos('frame', 'chartreuse-ring', 'Chartreuse ring', 'A thin chartreuse halo for level 5.', { level: 5 }),
  cos('frame', 'gold-laurel', 'Gold laurel', 'Laurels for a seasoned player.', { level: 10 }),
  cos('frame', 'ember', 'Ember', 'Glows for fifty wins.', { achievement: 'wins-50' }),
  cos('frame', 'prism', 'Prism', 'Refracts at level 25.', { level: 25 }),
  cos('frame', 'obsidian', 'Obsidian', 'Dark glass, sharp edge. A full week played.', {
    achievement: 'streak-7',
  }),
  cos('frame', 'called-halo', 'Called', 'A ring earned at the Edge badge.', { conviction: 'edge' }),
  cos('frame', 'deadeye', 'Dead eye', 'For a Dead eye conviction badge.', { conviction: 'deadeye' }),
  cos('title', 'challenger', 'Challenger', 'Everyone starts here.'),
  cos('title', 'quiz-hound', 'Quiz hound', 'Follows every clue. Your first duel.', {
    achievement: 'first-duel',
  }),
  cos('title', 'speedster', 'Speedster', 'For a sub-1.5 s answer.', { achievement: 'speed-demon' }),
  cos('title', 'stampsmith', 'Stampsmith', 'Every expedition stamped.', { achievement: 'all-routes' }),
  cos('title', 'sage', 'Sage', 'Level 25 and counting.', { level: 25 }),
  cos('title', 'gauntlet-runner', 'Gauntlet runner', 'A perfect 5-0 Gauntlet.', {
    achievement: 'perfect-gauntlet',
  }),
  cos('title', 'platinum', 'Platinum', 'Reached Platinum in the arena.', { rank: 'platinum' }),
  cos('title', 'caller', 'Caller', 'Your calls reached the Read badge.', { conviction: 'read' }),
  cos('title', 'sharp', 'Sharp', 'Your calls reached the Sharp badge.', { conviction: 'sharp' }),
  cos('banner', 'midnight', 'Midnight', 'The default banner.'),
  cos('banner', 'stadium-lights', 'Stadium lights', 'Floodlit turf for ten wins.', {
    achievement: 'wins-10',
  }),
  cos('banner', 'nebula', 'Nebula', 'Deep-field colour. Three days running.', { achievement: 'streak-3' }),
  cos('banner', 'lab-glass', 'Lab glass', 'Beakers and bench light for the curious.', {
    achievement: 'curious-25',
  }),
  cos('banner', 'called-it', 'Called it', 'Ticker tape for the Edge badge.', { conviction: 'edge' }),
  cos('banner', 'field-notes', 'Field notes', 'Graph paper and margin scribbles for level 8.', { level: 8 }),
  cos('banner', 'championship', 'Championship', 'Confetti for level 15.', { level: 15 }),
  cos('accent', 'volt', 'Volt', 'The default accent hue.'),
  cos('accent', 'coral', 'Coral', 'Warm coral accent for level 3.', { level: 3 }),
  cos('accent', 'cyan', 'Cyan', 'Cool cyan accent for a hat-trick.', { achievement: 'combo-3' }),
  cos('accent', 'magenta', 'Magenta', 'Loud magenta accent for the mode tour.', { achievement: 'mode-tour' }),
  cos('accent', 'gold', 'Gold', 'Gold accent for level 20.', { level: 20 }),
]);
export const cosmeticById = (id) => COSMETICS.find((c) => c.id === id);
/** The four starting items: always equippable, never listed in `cosmetics.owned`. */
export const isDefaultCosmetic = (c) => !!c && DEFAULT_COSMETICS[c.kind] === c.id;
/** Every unlock condition on a cosmetic, met against the progression it is asked about. */
export function unlockMet(prog, cosmetic) {
  const c = typeof cosmetic === 'string' ? cosmeticById(cosmetic) : cosmetic;
  if (!c) return false;
  const u = c.unlock;
  if (u.level && levelForXp(prog.xp).level < u.level) return false;
  if (u.achievement && !Object.hasOwn(prog.achievements, u.achievement)) return false;
  if (u.rank && rankIndex(prog.rank.best) < rankIndex(u.rank)) return false;
  if (u.conviction && convictionIndex(prog.conviction.best) < convictionIndex(u.conviction)) return false;
  return true;
}
/** True when a cosmetic can be equipped: already owned, or every unlock condition is met. */
export function canEquip(prog, cosmetic) {
  const c = typeof cosmetic === 'string' ? cosmeticById(cosmetic) : cosmetic;
  if (!c) return false;
  if (prog.cosmetics.owned.includes(c.id)) return true;
  return unlockMet(prog, c);
}
/**
 * The owned list a progression should carry: what it already lists (a migrated purchase stays owned
 * for good, whatever its unlock rule says today) plus every non-default item whose unlock is met.
 * Ownership is automatic on unlock — the reducer materialises it the moment the rule is met and
 * readProgression does the same on load — so 'unlocked' is only ever seen on a state built by hand.
 * Same reference when nothing is missing.
 */
export function ownedCosmetics(prog) {
  const owned = prog.cosmetics.owned;
  const fresh = COSMETICS.filter((c) => !isDefaultCosmetic(c) && !owned.includes(c.id) && unlockMet(prog, c));
  return fresh.length ? [...owned, ...fresh.map((c) => c.id)] : owned;
}
/** 'equipped' | 'owned' | 'unlocked' (rule met, not yet materialised) | 'locked' for the UI. */
export function cosmeticStatus(prog, id) {
  const c = cosmeticById(id);
  if (!c) return 'locked';
  if (prog.cosmetics.equipped[c.kind] === c.id) return 'equipped';
  if (prog.cosmetics.owned.includes(c.id) || isDefaultCosmetic(c)) return 'owned';
  return unlockMet(prog, c) ? 'unlocked' : 'locked';
}
// ---------------------------------------------------------------------------------------------
// State
const COUNTER_KEYS = Object.freeze([
  'rounds',
  'correct',
  'matches',
  'wins',
  'losses',
  'draws',
  'humanMatches',
  'expeditions',
  'stamps',
  'facts',
  'opens',
  'recalls',
  'saves',
  'reviews',
  'discoveries',
  'eventModes',
  'questsDone',
  'bestCombo',
  'perfectGauntlets',
]);
export const LOG_KINDS = Object.freeze([
  'round',
  'match',
  'discovery',
  'expedition-answer',
  'expedition-complete',
  'fact',
  'open',
  'recall',
  'save',
  'review',
  'event',
  'streak',
  'quest',
  'quests-bonus',
  'level',
  'achievement',
  'rank',
  'cosmetic',
]);
export function emptyProgression() {
  return {
    version: PROGRESSION_VERSION,
    xp: 0,
    counters: {
      ...Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])),
      fastestCorrectMs: null,
      byTopic: Object.fromEntries(TOPICS.map((t) => [t, { rounds: 0, correct: 0 }])),
      byMode: Object.fromEntries(MODES.map((m) => [m, { played: 0, wins: 0 }])),
    },
    streak: { current: 0, best: 0, lastDay: null, shields: 0, frozenDays: 0 },
    achievements: {},
    eventBadges: {},
    ...(TIMED_ANSWER_XP ? { stopwatchDaily: { day: null, mask: 0 } } : {}),
    quests: { day: null, seed: null, items: [] },
    rank: { points: 0, tier: 'bronze', best: 'bronze', floor: 0 },
    conviction: {
      steady: { n: 0, correct: 0 },
      bold: { n: 0, correct: 0 },
      called: { n: 0, correct: 0 },
      counted: [], // factIds whose FIRST expedition answer has been tallied (R1)
      recent: [], // up to CONVICTION_WINDOW codes, oldest first. Drives the brain hero only.
      best: 'provisional', // high-water-mark badge tier, mirrors rank.best
      bestAt: null, // the rating when `best` was last raised. null while provisional.
    },
    cosmetics: { owned: [], equipped: { ...DEFAULT_COSMETICS } },
    log: [],
  };
}
const nat = (v, max = Number.MAX_SAFE_INTEGER) => (Number.isSafeInteger(v) && v > 0 ? Math.min(v, max) : 0);
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const META_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,30}$/;
// Limited-time event badges: a kebab-case badge id -> the timestamp it was first earned.
const BADGE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const EVENT_BADGE_LIMIT = 200;
const validBadge = (id) => typeof id === 'string' && id.length <= 64 && BADGE_KEY.test(id);
function readMeta(meta) {
  const out = {};
  for (const [k, v] of Object.entries(obj(meta)).slice(0, 12))
    if (
      META_KEY.test(k) &&
      (v === null ||
        typeof v === 'boolean' ||
        (typeof v === 'number' && Number.isFinite(v)) ||
        (typeof v === 'string' && v.length <= 200))
    )
      out[k] = v;
  return Object.keys(out).length ? out : null;
}
function readLogEntry(e) {
  if (
    !e ||
    !str(e.id, 120) ||
    !Number.isFinite(e.at) ||
    !LOG_KINDS.includes(e.kind) ||
    !Number.isSafeInteger(e.xp) ||
    e.xp < 0 ||
    !str(e.label, 200)
  )
    return null;
  const out = { id: e.id, at: e.at, kind: e.kind, xp: e.xp, label: e.label };
  const meta = readMeta(e.meta);
  if (meta) out.meta = meta;
  return out;
}
function readQuestItem(i) {
  const t = i && questTemplate(i.template);
  if (!t || !str(i.id, 120)) return null;
  if (t.pick === 'topic' && !TOPICS.includes(i.topic)) return null;
  if (t.pick === 'mode' && !MODES.includes(i.mode)) return null;
  const done = i.done === true;
  const item = {
    id: i.id,
    template: t.id,
    label: '',
    target: t.target,
    progress: done ? t.target : Math.min(t.target, nat(i.progress)),
    xp: t.xp,
    done,
    claimedAt: done && Number.isFinite(i.claimedAt) ? i.claimedAt : null,
  };
  if (t.pick === 'topic') item.topic = i.topic;
  if (t.pick === 'mode') item.mode = i.mode;
  item.label = questLabel(t, item);
  return item;
}
/**
 * Sanitizer: clamps ints, whitelists ids, drops unknown keys, caps arrays. Identity on valid state.
 * A version 1 record is read the same way and comes out at the current version: its wallet is not
 * read at all, its owned cosmetics are kept and its equipped set is kept where still equippable.
 */
export function readProgression(value) {
  const next = emptyProgression();
  if (!value || typeof value !== 'object' || !READABLE_VERSIONS.includes(value.version)) return next;
  next.xp = nat(value.xp);
  if (TIMED_ANSWER_XP) {
    const d = value.stopwatchDaily;
    if (d && typeof d.day === 'string' && DAY_RE.test(d.day) && Number.isInteger(d.mask) && d.mask >= 0 && d.mask <= 31)
      next.stopwatchDaily = { day: d.day, mask: d.mask };
  }
  const c = obj(value.counters);
  for (const k of COUNTER_KEYS) next.counters[k] = nat(c[k]);
  next.counters.fastestCorrectMs =
    Number.isSafeInteger(c.fastestCorrectMs) && c.fastestCorrectMs >= 0 ? c.fastestCorrectMs : null;
  for (const t of TOPICS) {
    const v = obj(obj(c.byTopic)[t]);
    next.counters.byTopic[t] = { rounds: nat(v.rounds), correct: Math.min(nat(v.correct), nat(v.rounds)) };
  }
  for (const m of MODES) {
    const v = obj(obj(c.byMode)[m]);
    next.counters.byMode[m] = { played: nat(v.played), wins: Math.min(nat(v.wins), nat(v.played)) };
  }
  const s = obj(value.streak);
  const lastDay = typeof s.lastDay === 'string' && DAY_RE.test(s.lastDay) ? s.lastDay : null;
  const current = lastDay ? nat(s.current) : 0;
  next.streak = {
    current,
    best: Math.max(current, nat(s.best)),
    lastDay,
    shields: Math.min(2, nat(s.shields)),
    frozenDays: nat(s.frozenDays),
  };
  const a = obj(value.achievements);
  for (const item of ACHIEVEMENTS) if (Number.isFinite(a[item.id])) next.achievements[item.id] = a[item.id];
  // Badge ids are minted by lib/events.mjs, so they are whitelisted by shape rather than by list.
  for (const [id, earnedAt] of Object.entries(obj(value.eventBadges))) {
    if (Object.keys(next.eventBadges).length >= EVENT_BADGE_LIMIT) break;
    if (validBadge(id) && Number.isSafeInteger(earnedAt) && earnedAt > 0) next.eventBadges[id] = earnedAt;
  }
  const q = obj(value.quests);
  if (typeof q.day === 'string' && DAY_RE.test(q.day)) {
    next.quests.day = q.day;
    next.quests.seed = str(q.seed, 200) ? q.seed : null;
    next.quests.items = (Array.isArray(q.items) ? q.items : [])
      .map(readQuestItem)
      .filter(Boolean)
      .slice(0, 3);
  }
  const r = obj(value.rank);
  let points = nat(r.points),
    best = RANK_TIERS.some((t) => t.id === r.best) ? r.best : 'bronze';
  if (rankIndex(rankForPoints(points).tier) > rankIndex(best)) best = rankForPoints(points).tier;
  const floor = RANK_TIERS[rankIndex(best)].min;
  points = Math.max(points, floor);
  next.rank = { points, tier: rankForPoints(points).tier, best, floor };
  const cv = obj(value.conviction);
  for (const k of ['steady', 'bold', 'called']) {
    const v = obj(cv[k]);
    next.conviction[k] = { n: nat(v.n), correct: Math.min(nat(v.correct), nat(v.n)) };
  }
  // Bounded before it is walked: both fields have a hard cap known up front, and load-time
  // sanitisation runs on the main thread inside the profile transaction, so an oversized array from
  // a corrupted blob must not be filtered in full before being thrown away.
  next.conviction.counted = [
    ...new Set(
      (Array.isArray(cv.counted) ? cv.counted : [])
        .slice(-4 * CONVICTION_COUNTED_LIMIT)
        .filter(
          (id) =>
            typeof id === 'string' &&
            /^[A-Za-z0-9:_-]{1,80}$/.test(id) &&
            !['__proto__', 'constructor', 'prototype'].includes(id),
        ),
    ),
    // R4: the writer keeps the NEWEST ids, so the sanitiser must too — keeping the oldest would
    // discard exactly the facts the reducer just counted, reopening R1 for the most recent ones.
  ].slice(-CONVICTION_COUNTED_LIMIT);
  next.conviction.recent = (Array.isArray(cv.recent) ? cv.recent : [])
    .slice(-4 * CONVICTION_WINDOW)
    .filter((c) => CONVICTION_CODES.includes(c))
    .slice(-CONVICTION_WINDOW);
  // The badge never demotes, so `best` is whitelisted and then raised to whatever the sanitised tallies
  // actually support — the same high-water-mark repair rank does above. bestAt is repaired to the live
  // rating rather than invented, so the card can never print a badge with no earned-at number.
  let cBest = CONVICTION_TIERS.some((t) => t.id === cv.best) ? cv.best : 'provisional';
  const cNow = convictionTier(next.conviction).id;
  // A stored bestAt belongs to a stored best. When the load raises the tier because the tallies have
  // outrun it, the old number is below the new badge's own floor, and the card would print a rating
  // that could not have earned the badge beside it.
  const raised = convictionIndex(cNow) > convictionIndex(cBest);
  if (raised) cBest = cNow;
  next.conviction.best = cBest;
  next.conviction.bestAt =
    cBest === 'provisional'
      ? null
      : !raised && Number.isSafeInteger(cv.bestAt) && cv.bestAt >= 0 && cv.bestAt <= 2000
        ? cv.bestAt
        : convictionRating(next.conviction);
  const co = obj(value.cosmetics);
  // Anything the record says is owned stays owned (a version 1 purchase most of all); then whatever
  // the sanitised progression above has unlocked is materialised, so a load and a reduce agree.
  next.cosmetics.owned = [
    ...new Set(
      (Array.isArray(co.owned) ? co.owned : []).filter((id) => {
        const c = cosmeticById(id);
        return !!c && !isDefaultCosmetic(c);
      }),
    ),
  ].slice(0, COSMETICS.length);
  next.cosmetics.owned = ownedCosmetics(next);
  for (const kind of COSMETIC_KINDS) {
    const id = obj(co.equipped)[kind],
      item = cosmeticById(id);
    next.cosmetics.equipped[kind] =
      item && item.kind === kind && canEquip(next, item) ? id : DEFAULT_COSMETICS[kind];
  }
  next.log = (Array.isArray(value.log) ? value.log : [])
    .map(readLogEntry)
    .filter(Boolean)
    .slice(0, LOG_LIMIT);
  return next;
}
// ---------------------------------------------------------------------------------------------
// Events: a pure diff of two profiles (plus the action that produced the change) into typed events.
const clip = (v) => (typeof v === 'string' ? v.slice(0, 200) : v);
/**
 * deriveEvents(before, after, action) -> events. Kinds: round, match, discovery, expedition-answer,
 * expedition-complete, review, fact, open, recall, save, visit. Every source is exactly-once by
 * construction (new journal ids, new fact ids, false->true flags, completion deltas), so repeated
 * snapshots yield [].
 */
export function deriveEvents(before, after, action) {
  const events = [];
  if (!before || !after || !action) return events;
  const at = Number.isFinite(action.at) ? action.at : Date.now(),
    hour = new Date(at).getHours();
  const bj = before.journal,
    aj = after.journal;
  if (action.type === 'room' && action.room && aj !== bj) {
    const room = action.room,
      seat = room.seat === 1 ? 1 : 0;
    const known = new Set(bj.rounds.map((r) => r.id));
    const fresh = aj.rounds.filter((r) => r.matchId === room.id && !known.has(r.id));
    if (fresh.length) {
      const order = (Array.isArray(room.completedRounds) ? room.completedRounds : [])
        .filter((r) => r && r.result)
        .map((r) => ({ id: r.id, index: r.index, correct: r.receipts?.[seat]?.correct === true }));
      const live = room.round;
      if (live?.result && !order.some((r) => r.id === live.id))
        order.push({ id: live.id, index: room.roundIndex, correct: live.receipts?.[seat]?.correct === true });
      order.sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
      const combos = new Map();
      let run = 0;
      for (const r of order) {
        run = r.correct ? run + 1 : 0;
        combos.set(r.id, { combo: run, index: Number.isInteger(r.index) ? r.index : 0 });
      }
      for (const r of [...fresh].reverse()) {
        const meta = combos.get(r.id);
        events.push({
          kind: 'round',
          correct: r.correct === true,
          elapsedMs: Number.isFinite(r.elapsedMs) ? r.elapsedMs : null,
          bot: r.bot === true,
          topic: r.topic,
          difficulty: DIFFICULTIES.includes(r.difficulty) ? r.difficulty : null,
          matchId: r.matchId,
          roundId: r.id,
          index: meta?.index ?? 0,
          combo: r.correct === true ? Math.max(1, meta?.combo ?? 1) : 0,
          wild: wildRound(r.id),
          hour,
        });
      }
    }
    const knownMatches = new Set(bj.matches.map((m) => m.id));
    const match = aj.matches.find((m) => m.id === room.id && !knownMatches.has(m.id));
    if (match) {
      const opener = (Array.isArray(room.completedRounds) ? room.completedRounds : []).find(
        (r) => r && r.index === 0 && r.result,
      );
      const first = opener ?? (room.roundIndex === 0 && room.round?.result ? room.round : null);
      const scores = Array.isArray(match.scores)
        ? [match.scores[seat] ?? 0, match.scores[1 - seat] ?? 0]
        : [0, 0];
      events.push({
        kind: 'match',
        mode: match.mode,
        outcome: match.outcome,
        bot: match.bot === true,
        scores,
        comeback: match.outcome === 'win' && match.mode === 'trilogy' && first?.result?.winner === 1 - seat,
        topic: typeof room.config?.topic === 'string' ? room.config.topic : 'all',
        topics: [...new Set(aj.rounds.filter((r) => r.matchId === room.id).map((r) => r.topic))],
        matchId: match.id,
      });
    }
  }
  if (action.type === 'practice' && aj !== bj) {
    const known = new Set(bj.rounds.map((r) => r.id));
    const r = aj.rounds.find((x) => x.id === action.roundId && !known.has(x.id));
    if (r) {
      const daily = TIMED_ANSWER_XP ? /^practice:daily-(\d{4}-\d{2}-\d{2}):([0-4])$/.exec(r.id) : null;
      const paid = before.progression?.stopwatchDaily;
      const alreadyDaily = daily && paid?.day && (daily[1] < paid.day || (daily[1] === paid.day && (paid.mask & (1 << Number(daily[2]))) !== 0));
      // Fact aggregates persist after the 200-row journal is trimmed. Reopening an old one-card
      // link cannot become another discovery reward, even after its individual attempt was evicted.
      const alreadyTaster = TIMED_ANSWER_XP && r.id.startsWith('practice:taster-') && before.journal.facts?.[r.factId]?.bySurface?.discovery > 0;
      if (!alreadyDaily && !alreadyTaster) events.push({ kind: 'discovery', correct: r.correct === true, elapsedMs: r.elapsedMs, topic: r.topic, roundId: r.id,
        ...(daily ? { dailyDay: daily[1], dailyIndex: Number(daily[2]) } : {}),
      });
    }
  }
  if (action.type === 'review' && aj !== bj) {
    // Attempts are written by prepend, so the newest entry is the only one this action can have added;
    // scanning the tail would let a reordered array mint a second event for an attempt already paid.
    const t = (Array.isArray(aj.attempts) ? aj.attempts : [])[0];
    const known = new Set((Array.isArray(bj.attempts) ? bj.attempts : []).map((x) => x.id));
    if (t && !known.has(t.id)) {
      const bRec = bj.facts?.[t.factId] ?? null,
        aRec = aj.facts?.[t.factId] ?? null;
      // `due` and `advanced` are read off the schedule's own box update rather than claimed by the
      // caller, so a revealed or off-queue re-attempt records fully and pays nothing.
      events.push({
        kind: 'review',
        factId: t.factId,
        correct: t.correct === true,
        due: !!bRec && Number.isFinite(bRec.due) && bRec.due <= at,
        advanced: !!bRec && !!aRec && (aRec.box !== bRec.box || aRec.due !== bRec.due),
      });
    }
  }
  if (action.type === 'journey-answer' || action.type === 'journey-next') {
    const route = expeditionById(action.routeId);
    const b = route ? before.journeys?.[route.key] : null,
      a = route ? after.journeys?.[route.key] : null;
    if (route && a && a !== b) {
      const run = a.run,
        prior = b?.run && b.run.id === run?.id ? b.run.answers.length : 0;
      if (action.type === 'journey-answer' && run && run.answers.length > prior) {
        const i = run.answers.length - 1,
          ans = run.answers[i];
        events.push({
          kind: 'expedition-answer',
          correct: ans.choice === run.cards[i].correctIndex,
          confidence: ans.confidence,
          elapsedMs: ans.elapsedMs,
          // R1 is decided in the reducer against progression.conviction.counted, so the card the
          // answer landed on has to travel with the event.
          factId: run.cards[i].factId,
          routeId: route.id,
          topic: route.topic,
          index: i,
        });
      }
      if (action.type === 'journey-next' && (a.completions || 0) > (b?.completions || 0) && a.last)
        events.push({
          kind: 'expedition-complete',
          routeId: route.id,
          topic: route.topic,
          score: a.last.score,
          correct: a.last.correct,
          bold: a.last.bold,
          stakes: a.last.stakes ?? null,
          // The score this run has to beat to pay score XP again, read before the completion wrote
          // over it: a replayed route pays only for the improvement. It comes from the record's own
          // monotone high-water mark, never from `best`, which is ordered by correctness first and
          // so can sit below a score the player has already posted — that gap paid the same
          // "improvement" on every replay, for ever.
          previousBest: Number.isInteger(b?.bestScore) ? b.bestScore : (b?.best?.score ?? 0),
          first: !b?.first,
        });
    }
  }
  const bf = before.passport?.facts ?? {},
    af = after.passport?.facts ?? {};
  if (af !== bf)
    for (const [id, f] of Object.entries(af)) {
      const prev = bf[id];
      if (!prev) events.push({ kind: 'fact', factId: id, topic: f.topic });
      if (f.opened && !prev?.opened) events.push({ kind: 'open', factId: id, topic: f.topic });
      if (f.recalled && !prev?.recalled) events.push({ kind: 'recall', factId: id, topic: f.topic });
    }
  if (action.type === 'save' && aj !== bj && aj.saved.length > bj.saved.length)
    events.push({ kind: 'save', question: clip(aj.saved[0]) });
  if (action.type === 'visit') events.push({ kind: 'visit' });
  return events;
}
/**
 * The one event limited-time modes produce, built from a mode out of lib/events.mjs. Exactly-once is
 * enforced by the badge rather than by a profile diff: reduceProgression pays a badge only the first
 * time it sees it, so a replayed or re-submitted mode adds nothing.
 */
export function eventModeEvent({ badge, modeId, xpBonus } = {}) {
  return {
    kind: 'event-mode',
    badge,
    modeId,
    xpBonus: Number.isFinite(xpBonus) ? Math.min(2, Math.max(1, xpBonus)) : 1,
  };
}
// ---------------------------------------------------------------------------------------------
// Reducer
function logEntry(at, kind, xp, label, meta) {
  const entry = { at, kind, xp, label };
  const clean = meta ? readMeta(meta) : null;
  if (clean) entry.meta = clean;
  return entry;
}
function prependLog(log, entries) {
  const taken = new Set(log.map((e) => e.id));
  const stamped = entries.map((e) => {
    let n = 0,
      id;
    do id = `${e.at}:${e.kind}:${n++}`;
    while (taken.has(id));
    taken.add(id);
    return { id, ...e };
  });
  return [...stamped.reverse(), ...log].slice(0, LOG_LIMIT);
}
function mapSame(list, fn) {
  let out = list;
  list.forEach((x, i) => {
    const y = fn(x);
    if (y !== x) {
      if (out === list) out = [...list];
      out[i] = y;
    }
  });
  return out;
}
/**
 * Equips. Same reference when the action is not allowed or changes nothing. Nothing is for sale: a
 * 'cosmetic-buy' action from an old client is a no-op and returns the same object.
 */
export function reduceCosmetics(prog, action) {
  const c = cosmeticById(action?.id);
  if (!c) return prog;
  if (action.type === 'cosmetic-equip') {
    if (!canEquip(prog, c) || prog.cosmetics.equipped[c.kind] === c.id) return prog;
    return {
      ...prog,
      cosmetics: { ...prog.cosmetics, equipped: { ...prog.cosmetics.equipped, [c.kind]: c.id } },
    };
  }
  return prog;
}
/**
 * Edition switches. The defaults are JHK's behaviour and JHK never calls the setter.
 *  - `visitCreditsStreak` (default true): a 'visit' (opening the app) credits the day streak, its XP
 *    and the streak Stamp Register rewards. HISAAB DO turns it off — its ladder is climbed "receipt by
 *    receipt" (charter §1) — so only a day with play counts; a visit still rolls the daily quests.
 *  - `rankHumanMatches` (default true): a match against a person moves the arena rank. HISAAB DO turns
 *    it off: its only human matches are peer-to-peer friend duels, where each browser reports its own
 *    times, and it promises they are unranked. They still pay XP.
 */
const OPTIONS = { visitCreditsStreak: true, rankHumanMatches: true };
export function setProgressionOptions(next = {}) {
  for (const key of Object.keys(OPTIONS)) if (typeof next?.[key] === 'boolean') OPTIONS[key] = next[key];
  return { ...OPTIONS };
}
export const progressionOptions = () => ({ ...OPTIONS });

/**
 * reduceProgression(prog, events, at, ctx) applies exactly-once events: XP, counters, quest roll +
 * progress + auto-claim, streak credit, level-ups, achievements, rank, cosmetic unlocks.
 * ctx = { epoch, profile }. Returns the same reference when nothing changes (no events, or a
 * same-day visit).
 */
export function reduceProgression(prog, events, at = Date.now(), ctx = {}) {
  if (!prog) prog = emptyProgression();
  if (!Array.isArray(events) || !events.length) return prog;
  if (!Number.isFinite(at)) at = Date.now();
  const today = dayKey(at),
    rolled = prog.quests.day !== today;
  const quests = rolled ? dailyQuests(ctx.epoch ?? 'initial', today) : prog.quests;
  const allDoneBefore = quests.items.length > 0 && quests.items.every((i) => i.done);
  let items = quests.items;
  const counters = {
    ...prog.counters,
    byTopic: { ...prog.counters.byTopic },
    byMode: { ...prog.counters.byMode },
  };
  let xp = prog.xp,
    rank = prog.rank,
    eventBadges = prog.eventBadges || {},
    stopwatchDaily = prog.stopwatchDaily || { day: null, mask: 0 },
    dirty = rolled;
  let conviction = prog.conviction || emptyProgression().conviction;
  let counted = conviction.counted,
    recent = conviction.recent,
    convictionBest = conviction.best,
    bestAt = conviction.bestAt;
  const countedSet = new Set(counted);
  const entries = [];
  const award = (kind, amount, label, meta) => {
    xp += amount;
    entries.push(logEntry(at, kind, amount, label, meta));
    dirty = true;
  };
  // Small, frequent sources are aggregated into one log line per reduce.
  const small = { fact: 0, open: 0, recall: 0, save: 0 };
  for (const e of events) if (Object.hasOwn(small, e.kind)) small[e.kind] += 1;
  if (small.fact) {
    counters.facts += small.fact;
    award('fact', small.fact * XP.fact, small.fact === 1 ? 'New fact' : `${small.fact} new facts`, {
      count: small.fact,
    });
  }
  if (small.open) {
    counters.opens += small.open;
    award(
      'open',
      small.open * XP.open,
      small.open === 1 ? 'Explanation opened' : `${small.open} explanations opened`,
      {
        count: small.open,
      },
    );
  }
  if (small.recall) {
    counters.recalls += small.recall;
    award(
      'recall',
      small.recall * XP.recall,
      small.recall === 1 ? 'Untimed recall' : `${small.recall} untimed recalls`,
      {
        count: small.recall,
      },
    );
  }
  if (small.save) {
    counters.saves += small.save;
    award(
      'save',
      small.save * XP.save,
      small.save === 1 ? 'Saved to Vault' : `${small.save} saved to Vault`,
      {
        count: small.save,
      },
    );
  }
  for (const e of events) {
    if (e.kind === 'round') {
      counters.rounds += 1;
      if (e.correct) counters.correct += 1;
      if (Object.hasOwn(counters.byTopic, e.topic)) {
        const t = counters.byTopic[e.topic];
        counters.byTopic[e.topic] = { rounds: t.rounds + 1, correct: t.correct + (e.correct ? 1 : 0) };
      }
      const combo = e.correct ? Math.max(1, Number.isInteger(e.combo) ? e.combo : 1) : 0;
      if (combo > counters.bestCombo) counters.bestCombo = combo;
      const ms = e.correct && Number.isFinite(e.elapsedMs) ? Math.round(e.elapsedMs) : null;
      if (ms !== null && (counters.fastestCorrectMs === null || ms < counters.fastestCorrectMs))
        counters.fastestCorrectMs = ms;
      const base = e.correct ? (e.bot ? XP.roundCorrectBot : XP.roundCorrectHuman) : XP.roundWrong;
      const speed = ms === null ? 0 : ms < 2000 ? XP.speedFast : ms < 4000 ? XP.speedQuick : 0;
      const difficulty = DIFFICULTY_MULTIPLIER[e.difficulty] ?? 1,
        multiplier = comboMultiplier(combo),
        wild = e.wild === 2 || e.wild === 3 ? e.wild : 1;
      const amount = TIMED_ANSWER_XP ? TIMED_ANSWER_XP(e.correct, e.elapsedMs) : Math.round((base + speed) * difficulty * multiplier) * wild;
      const label = TIMED_ANSWER_XP ? (e.correct ? `Correct answer · ${amount} stopwatch XP` : 'Missed answer · 0 XP') : [
        e.correct ? 'Correct answer' : 'Missed answer',
        speed ? 'fast' : null,
        e.difficulty && e.difficulty !== 'simple' ? e.difficulty : null,
        combo >= 2 ? `x${multiplier} combo` : null,
        wild > 1 ? `Wild round x${wild}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      award('round', amount, label, {
        matchId: clip(e.matchId),
        index: e.index,
        combo,
        elapsedMs: ms,
        difficulty: e.difficulty ?? null,
        wild,
        topic: clip(e.topic),
        ...(TIMED_ANSWER_XP ? { scoring: 'stopwatch-v1' } : {}),
      });
      if (TIMED_ANSWER_XP && wild > 1 && amount > 0)
        award('event', amount * (wild - 1), `Surprise Audit bonus +${amount * (wild - 1)} XP`, {
          matchId: clip(e.matchId), index: e.index, bonus: 'surprise-audit', multiplier: wild,
        });
    } else if (e.kind === 'match') {
      counters.matches += 1;
      counters[e.outcome === 'win' ? 'wins' : e.outcome === 'loss' ? 'losses' : 'draws'] += 1;
      if (!e.bot) counters.humanMatches += 1;
      if (Object.hasOwn(counters.byMode, e.mode)) {
        const m = counters.byMode[e.mode];
        counters.byMode[e.mode] = { played: m.played + 1, wins: m.wins + (e.outcome === 'win' ? 1 : 0) };
      }
      let amount =
        e.outcome === 'win'
          ? (XP.matchWin[e.mode] ?? XP.matchWin.quick)
          : e.outcome === 'loss'
            ? XP.matchLoss
            : XP.matchDraw;
      if (!e.bot) amount = Math.round(amount * XP.humanMultiplier);
      const perfect = e.outcome === 'win' && e.mode === 'gauntlet' && e.scores[0] === 5 && e.scores[1] === 0;
      if (perfect) {
        amount += XP.perfectGauntlet;
        counters.perfectGauntlets += 1;
      }
      const word = e.outcome === 'win' ? 'Won' : e.outcome === 'loss' ? 'Lost' : 'Drew';
      award(
        'match',
        amount,
        [`${word} ${MODE_NAMES[e.mode] ?? e.mode}`, perfect ? 'perfect' : null, e.bot ? null : 'vs friend']
          .filter(Boolean)
          .join(' · '),
        {
          matchId: clip(e.matchId),
          mode: e.mode,
          outcome: e.outcome,
          bot: e.bot,
          score: `${e.scores[0]}-${e.scores[1]}`,
          perfect,
        },
      );
      // Arena rank: demotion protection keeps points at or above the floor of the best tier reached.
      // (An edition may keep matches against a person out of the rank: `rankHumanMatches`.)
      let delta =
        !e.bot && !OPTIONS.rankHumanMatches
          ? 0
          : e.outcome === 'win'
            ? (XP.rankWin[e.mode] ?? XP.rankWin.quick)
            : e.outcome === 'loss'
              ? XP.rankLoss
              : XP.rankDraw;
      if (!e.bot && delta > 0) delta = Math.round(delta * XP.humanMultiplier);
      const points = Math.max(rank.floor, rank.points + delta);
      if (points !== rank.points) {
        const tier = rankForPoints(points).tier;
        const promoted = rankIndex(tier) > rankIndex(rank.best);
        const best = promoted ? tier : rank.best;
        rank = { points, tier, best, floor: RANK_TIERS[rankIndex(best)].min };
        if (promoted)
          entries.push(
            logEntry(at, 'rank', 0, `Promoted to ${RANK_TIERS[rankIndex(tier)].label}`, {
              from: prog.rank.tier,
              to: tier,
              points,
            }),
          );
        dirty = true;
      }
    } else if (e.kind === 'discovery') {
      if (TIMED_ANSWER_XP && typeof e.dailyDay === 'string' && DAY_RE.test(e.dailyDay) && Number.isInteger(e.dailyIndex) && e.dailyIndex >= 0 && e.dailyIndex < 5)
        stopwatchDaily = { day: e.dailyDay, mask: (stopwatchDaily.day === e.dailyDay ? stopwatchDaily.mask : 0) | (1 << e.dailyIndex) };
      counters.discoveries += 1;
      award(
        'discovery',
        TIMED_ANSWER_XP ? TIMED_ANSWER_XP(e.correct, e.elapsedMs) : e.correct ? XP.discoveryCorrect : XP.discovery,
        e.correct ? 'Discovery · correct' : 'Discovery attempt',
        {
          correct: e.correct,
          topic: clip(e.topic),
        },
      );
    } else if (e.kind === 'expedition-answer') {
      // R1: a fact's first expedition answer is the only one that moves the badge or pays in full.
      // Replay, fold-and-restart and re-run all land here as repeats, which is what makes the badge a
      // claim about distinct facts rather than about how many times a route was played.
      const tier = !TIMED_ANSWER_XP && CONFIDENCE_ORDER.includes(e.confidence) ? e.confidence : null;
      const fresh = typeof e.factId === 'string' && !countedSet.has(e.factId);
      const amount = TIMED_ANSWER_XP ? (fresh ? TIMED_ANSWER_XP(e.correct, e.elapsedMs) : 0) : fresh ? (e.correct ? XP.expeditionCorrect : XP.expeditionWrong) : XP.expeditionRepeat;
      // The brain window moves on EVERY answer, fresh or repeat: it is a recency display, not a claim.
      if (tier) recent = [...recent, `${tier[0]}${e.correct ? 1 : 0}`].slice(-CONVICTION_WINDOW);
      if (fresh) {
        countedSet.add(e.factId);
        counted = [...counted, e.factId].slice(-CONVICTION_COUNTED_LIMIT);
        if (tier) {
          const slot = conviction[tier];
          conviction = {
            ...conviction,
            [tier]: { n: slot.n + 1, correct: slot.correct + (e.correct ? 1 : 0) },
          };
        }
      }
      award(
        'expedition-answer',
        amount,
        [
          `Expedition card ${(e.index ?? 0) + 1}`,
          e.correct
            ? tier && tier !== 'steady'
              ? `${CONFIDENCE[tier].name.toLowerCase()} hit`
              : 'correct'
            : 'missed',
          fresh ? null : 'already met',
        ]
          .filter(Boolean)
          .join(' · '),
        {
          routeId: clip(e.routeId),
          index: e.index ?? 0,
          confidence: e.confidence,
          correct: e.correct,
          fresh,
        },
      );
      // Promotion is evaluated only when a fresh card moved the tally, and never opens a ceremony: a
      // full-screen celebration landing mid-run, next to the following stake choice, is escalation
      // reinforcement. The finish scorecard and a single toast carry it instead.
      if (fresh) {
        const to = convictionTier({ ...conviction, counted, recent, best: convictionBest, bestAt });
        if (convictionIndex(to.id) > convictionIndex(convictionBest)) {
          // The badge pays nothing but the badge: its cosmetics unlock below, once the tier is set.
          // (A version 1 record may still carry `conviction-<tier>` marks in eventBadges from the
          // bonus that used to be paid here; they are inert and stay there.)
          const from = convictionBest;
          convictionBest = to.id;
          bestAt = convictionRating({ ...conviction });
          award('rank', 0, `Conviction badge: ${to.label}`, { from, to: to.id, rating: bestAt });
        }
      }
    } else if (e.kind === 'expedition-complete') {
      counters.expeditions += 1;
      // A memorised replay of a route already stamped pays for the improvement and nothing else,
      // otherwise the one mode with no opponent, no timer and no failure state is also the best XP.
      // Both sides of the subtraction are floored at zero first. `previousBest` is the record's
      // monotone high-water mark, whose own floor is MIN_SCORE, so an unfloored baseline let a
      // player drive it below zero on purpose — six Called misses park it at -18 — and be paid the
      // 42-point "improvement" back up to a 24-point ceiling. Losing was the better opening move,
      // and one replay out-paid the best possible honest first run. Floored, the score XP a route
      // can pay over its lifetime telescopes to exactly max(0, bestScoreEver) * expeditionScorePoint
      // whatever order the runs are played in, and nothing is minted by losing.
      const gained = e.first
        ? Math.max(0, e.score)
        : Math.max(0, Math.max(0, e.score) - Math.max(0, e.previousBest ?? 0));
      let amount = TIMED_ANSWER_XP ? (e.first ? XP.expeditionComplete : 0) : XP.expeditionComplete + gained * XP.expeditionScorePoint;
      if (e.first) {
        counters.stamps += 1;
        amount += XP.expeditionStamp;
      }
      award('expedition-complete', amount, e.first ? 'Expedition stamped' : 'Expedition finished', {
        routeId: clip(e.routeId),
        score: e.score,
        first: e.first === true,
      });
    } else if (e.kind === 'review') {
      // Paid only when the card was actually due and the answer moved its box: an off-queue or
      // revealed re-attempt is recorded in full by the journal and pays nothing here.
      if (e.due && e.advanced) {
        counters.reviews += 1;
        award(
          'review',
          e.correct ? XP.reviewCorrect : XP.review,
          e.correct ? 'Review · correct' : 'Review · missed',
          { factId: clip(e.factId), correct: e.correct === true },
        );
      }
    } else if (e.kind === 'event-mode') {
      // One badge, one award: replaying a limited mode is welcome but never pays a second time.
      if (validBadge(e.badge) && !Object.hasOwn(eventBadges, e.badge)) {
        const bonus = Number.isFinite(e.xpBonus) ? Math.min(2, Math.max(1, e.xpBonus)) : 1;
        counters.eventModes += 1;
        eventBadges = { ...eventBadges, [e.badge]: Math.max(1, Math.round(at)) };
        award(
          'event',
          Math.round(XP.eventMode * bonus),
          bonus > 1 ? `Limited mode cleared · x${bonus}` : 'Limited mode cleared',
          { badge: e.badge, modeId: clip(e.modeId), xpBonus: bonus },
        );
      }
    }
    // Quest progress counts every event of this reduce, including the one that rolled the day.
    items = mapSame(items, (i) => {
      const t = questTemplate(i.template);
      if (i.done || !t || !t.advances(e, i)) return i;
      return { ...i, progress: Math.min(i.target, i.progress + 1) };
    });
  }
  // Streak: any event credits today (with visitCreditsStreak off, any event but a visit); a same-day
  // repeat changes nothing.
  let streak = prog.streak;
  const credits = OPTIONS.visitCreditsStreak || events.some((e) => e?.kind !== 'visit');
  if (streak.lastDay !== today && credits) {
    const gap = streak.lastDay ? dayDiff(streak.lastDay, today) : 1;
    if (gap >= 1) {
      let { current, best, shields, frozenDays } = streak;
      const missed = gap - 1;
      if (!streak.lastDay) current = 1;
      else if (missed === 0) current += 1;
      else if (shields >= missed) {
        shields -= missed;
        frozenDays += missed;
        current += 1;
      } else current = 1;
      best = Math.max(best, current);
      if (current % 7 === 0) shields = Math.min(2, shields + 1);
      streak = { current, best, lastDay: today, shields, frozenDays };
      award('streak', XP.streakPerDay * Math.min(current, XP.streakCap), `Day ${current} streak`, {
        streak: current,
      });
    }
  }
  // Auto-claim finished quests, then the once-per-day bonus when all three are done.
  items = mapSame(items, (i) => {
    if (i.done || i.progress < i.target) return i;
    counters.questsDone += 1;
    award('quest', i.xp, i.label, { quest: i.id, template: i.template });
    return { ...i, done: true, claimedAt: at };
  });
  if (!allDoneBefore && items.length > 0 && items.every((i) => i.done))
    award('quests-bonus', XP.questBonus, 'All daily quests complete', { day: today });
  // Both literals below enumerate their keys explicitly, so the block has to be named in each of them
  // or every tally this reduce moved is dropped on the way out.
  const convictionOut = { ...conviction, counted, recent, best: convictionBest, bestAt };
  // Level-ups and achievements to a fixed point (achievement XP can unlock more).
  let level = levelForXp(prog.xp).level;
  const achievements = { ...prog.achievements };
  let draft = prog;
  for (let guard = 0; guard < 128; guard++) {
    const now = levelForXp(xp);
    if (now.level > level) {
      award('level', 0, `Level ${now.level} · ${now.title}`, { from: level, to: now.level });
      level = now.level;
    }
    draft = {
      ...prog,
      xp,
      counters,
      streak,
      achievements,
      eventBadges,
      ...(TIMED_ANSWER_XP ? { stopwatchDaily } : {}),
      quests: { ...quests, items },
      rank,
      conviction: convictionOut,
    };
    const hit = ACHIEVEMENTS.find((a) => !Object.hasOwn(achievements, a.id) && a.check(draft, events, ctx));
    if (!hit) break;
    achievements[hit.id] = at;
    award('achievement', hit.xp, hit.name, { achievement: hit.id, tier: hit.tier });
  }
  // Cosmetics unlock the moment their rule is met, and are owned from then on: one log line each,
  // read from the settled draft so a level, badge, rank or conviction tier set above counts now.
  const owned = ownedCosmetics(draft);
  const cosmetics = owned === prog.cosmetics.owned ? prog.cosmetics : { ...prog.cosmetics, owned };
  for (const id of owned.slice(prog.cosmetics.owned.length)) {
    const c = cosmeticById(id);
    award('cosmetic', 0, `Unlocked ${c.name}`, { id: c.id, kind: c.kind });
  }
  if (!dirty && streak === prog.streak && items === prog.quests.items) return prog;
  return {
    ...prog,
    xp,
    counters,
    streak,
    achievements,
    eventBadges,
    ...(TIMED_ANSWER_XP ? { stopwatchDaily } : {}),
    quests: items === quests.items ? quests : { ...quests, items },
    rank,
    conviction: convictionOut,
    cosmetics,
    log: entries.length ? prependLog(prog.log, entries) : prog.log,
  };
}
/** What changed between two progression states, so the UI can drive toasts and ceremonies. */
export function progressionDiff(before, after) {
  const from = levelForXp(before.xp),
    to = levelForXp(after.xp);
  const seen = new Set(before.log.map((e) => e.id));
  const doneBefore = new Set(
    before.quests.day === after.quests.day ? before.quests.items.filter((i) => i.done).map((i) => i.id) : [],
  );
  return {
    xpGained: after.xp - before.xp,
    leveledUp: to.level > from.level ? { from: from.level, to: to.level } : null,
    newAchievements: Object.keys(after.achievements).filter((id) => !Object.hasOwn(before.achievements, id)),
    questsCompleted: after.quests.items.filter((i) => i.done && !doneBefore.has(i.id)).map((i) => i.id),
    streakChanged:
      before.streak.current !== after.streak.current || before.streak.lastDay !== after.streak.lastDay,
    rankUp:
      rankIndex(after.rank.tier) > rankIndex(before.rank.tier)
        ? { from: before.rank.tier, to: after.rank.tier }
        : null,
    // Read by the finish scorecard and the toast path. Never by a ceremony opener: this promotion can
    // only happen mid-run.
    convictionUp:
      convictionIndex(after.conviction.best) > convictionIndex(before.conviction.best)
        ? { from: before.conviction.best, to: after.conviction.best, rating: after.conviction.bestAt }
        : null,
    logEntries: after.log.filter((e) => !seen.has(e.id)),
  };
}
