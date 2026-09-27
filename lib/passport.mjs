import {
  readJournal,
  readJournalValue,
  recordRoom,
  TOPIC_DOMAINS,
  DIFFICULTIES,
  SURFACES,
  STORE_LIMIT,
  dayKey,
  dayDiff,
} from './journal.mjs';
import {
  ATTEMPTS_PER_FACT,
  ATTEMPTS_TOTAL,
  emptySchedule,
  nextDays,
  nextSchedule,
  seedDeck,
  trimAttempts,
} from './journal-review.mjs';
import { readExpeditions, reduceExpeditions, expeditionById, CONFIDENCE } from './expeditions.mjs';
import { emptyAnalytics, readAnalytics, reduceAnalytics } from './analytics.mjs';
import { emptySupporter, readSupporter, reduceSupporter, sportOfTopic, cardProgress } from './season.mjs';
import {
  emptyProgression,
  readProgression,
  deriveEvents,
  reduceProgression,
  reduceCosmetics,
  eventModeEvent,
} from './progression.mjs';
export { TOPIC_DOMAINS };
export const FACT_LIMIT = 1200;
const modes = ['quick', 'trilogy', 'gauntlet'];
const skins = ['classic', 'orbit', 'grid', 'rally'];
const text = (x) => typeof x === 'string' && x.length > 0 && x.length <= 100;
const text500 = (x) => typeof x === 'string' && x.length <= 500;
// The key rule for passport.facts, shared by the loader and the review writer so neither side can
// admit a fact id the other would drop on the next load.
const factKey = (id) =>
  typeof id === 'string' &&
  /^[a-zA-Z0-9:_-]{1,80}$/.test(id) &&
  !['__proto__', 'constructor', 'prototype'].includes(id);
const text64 = (x) => typeof x === 'string' && x.length > 0 && x.length <= 64;
const text120 = (x) => typeof x === 'string' && x.length > 0 && x.length <= 120;
const idx32 = (x) => (Number.isInteger(x) && x >= 0 && x <= 31 ? x : 0);
const emptyBySurface = () => Object.fromEntries(SURFACES.map((s) => [s, 0]));
export function emptyProfile(epoch = 'initial', resetAt = 0) {
  return {
    version: 2,
    epoch,
    resetAt,
    revision: 0,
    issues: [],
    journeys: {},
    journal: readJournal(null),
    passport: { facts: {}, modes: [], openedAny: false, recalledAny: false, played: false, skin: 'classic' },
    progression: emptyProgression(),
    analytics: emptyAnalytics(),
    // Additive since the Season 1 slice: a profile stored before it reads back with an empty card.
    supporter: emptySupporter(),
  };
}
export function readProfile(value) {
  if (!value || value.version !== 2) return emptyProfile();
  const next = emptyProfile(
    text(value.epoch) ? value.epoch : 'initial',
    Number.isFinite(value.resetAt) ? value.resetAt : 0,
  );
  next.revision = Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0;
  next.journeys = readExpeditions(value.journeys);
  next.issues = (Array.isArray(value.issues) ? value.issues : [])
    .filter(
      (i) =>
        i &&
        typeof i.id === 'string' &&
        i.id.length < 200 &&
        ['incorrect', 'ambiguous', 'source', 'other'].includes(i.reason) &&
        typeof i.note === 'string' &&
        i.note.length <= 800 &&
        Number.isFinite(i.at) &&
        readJournalValue({ version: 1, rounds: [i.fact] }).rounds.length === 1,
    )
    .slice(0, 50);
  // The object form of the sanitiser, not the string one: this runs inside every readwrite transaction
  // on a 15 s heartbeat, and the stringify+parse leg it replaces cost more than every field check in the
  // journal put together — mid-duel, against a 50 ms timer tick on a track with no CSS transition.
  next.journal = readJournalValue(value.journal);
  next.progression = readProgression(value.progression);
  next.analytics = readAnalytics(value.analytics);
  next.supporter = readSupporter(value.supporter);
  const p = value.passport;
  if (p && typeof p === 'object') {
    for (const [id, f] of Object.entries(p.facts || {}).slice(0, FACT_LIMIT))
      if (factKey(id) && f && Object.hasOwn(TOPIC_DOMAINS, f.topic))
        next.passport.facts[id] = {
          topic: f.topic,
          opened: f.opened === true,
          recalled: f.recalled === true,
        };
    next.passport.modes = [
      ...new Set((Array.isArray(p.modes) ? p.modes : []).filter((m) => modes.includes(m))),
    ];
    for (const k of ['openedAny', 'recalledAny', 'played']) next.passport[k] = p[k] === true;
    next.passport.skin = skins.includes(p.skin) ? p.skin : 'classic';
  }
  if (!passportSummary(next.passport).skins.includes(next.passport.skin)) next.passport.skin = 'classic';
  return next;
}
export function passportSummary(p) {
  const facts = Object.values(p.facts),
    opened = facts.filter((f) => f.opened).length,
    recalled = facts.filter((f) => f.recalled).length;
  const topics = [...new Set(facts.map((f) => f.topic))],
    domains = [...new Set(topics.map((t) => TOPIC_DOMAINS[t]))];
  const missions = [
    {
      id: 'first',
      name: 'First field notes',
      description: 'A complete little loop, at your pace.',
      reward: 'Orbit card finish',
      skin: 'orbit',
      steps: [
        {
          label: 'Finish a duel or try an untimed question',
          done: p.played || p.recalledAny,
          action: 'play',
        },
        { label: 'Open a fact explanation', done: p.openedAny, action: 'journal' },
        { label: 'Try an untimed question', done: p.recalledAny, action: 'recall' },
      ],
    },
    {
      id: 'notes',
      name: 'Field notes',
      description: 'Give a few facts a second look.',
      reward: 'Grid card finish',
      skin: 'grid',
      steps: [
        { label: 'Encounter 5 distinct facts', done: facts.length >= 5, action: 'play' },
        { label: 'Open 3 fact explanations', done: opened >= 3, action: 'journal' },
        { label: 'Try 3 distinct untimed questions', done: recalled >= 3, action: 'recall' },
      ],
    },
    {
      id: 'tour',
      name: 'The mode tour',
      description: 'Three ways to settle a friendly debate.',
      reward: 'Rally card finish',
      skin: 'rally',
      steps: modes.map((mode, i) => ({
        label: `Finish ${['Quick Draw', 'Triple Threat', 'The Gauntlet'][i]}`,
        done: p.modes.includes(mode),
        action: mode,
      })),
    },
  ];
  for (const m of missions) m.complete = m.steps.every((s) => s.done);
  const available = ['classic', ...missions.filter((m) => m.complete).map((m) => m.skin)];
  const points = facts.length * 10 + opened * 5 + recalled * 5;
  const tiers = [
    { at: 0, name: 'New arrival' },
    { at: 50, name: 'Curiosity scout' },
    { at: 150, name: 'Field explorer' },
    { at: 350, name: 'Fact collector' },
    { at: 650, name: 'Arcade voyager' },
  ];
  const tier = [...tiers].reverse().find((t) => points >= t.at) || tiers[0],
    next = tiers.find((t) => t.at > points);
  return {
    facts: facts.length,
    opened,
    recalled,
    topics,
    domains,
    points,
    tier,
    next,
    missions,
    skins: available,
    complete: missions.filter((m) => m.complete).length,
  };
}
// All writes pass through this pure reducer inside one read-write browser DB transaction.
export function reduceProfile(profile, action) {
  if (action.type !== 'reset' && action.epoch && action.epoch !== profile.epoch) return profile;
  if (action.type === 'reset')
    return { ...emptyProfile(action.newEpoch, action.at), revision: profile.revision + 1 };
  let next = applyAction(profile, action);
  // Progression runs exactly once per user action on the before/after diff, never on raw polling.
  const at = Number.isFinite(action.at) ? action.at : Date.now();
  const events = deriveEvents(profile, next, action);
  // Limited-time event modes are the one progression event a profile diff cannot see: clearing a
  // mode changes nothing in the profile, only in the progression record. The screen reports it
  // explicitly and `eventModeEvent` sanitises it; reduceProgression still pays a badge only once.
  if (action.type === 'event-mode') events.push(eventModeEvent(action));
  const base = next.progression || emptyProgression();
  const progression = reduceProgression(base, events, at, { epoch: profile.epoch, profile: next });
  if (progression !== next.progression) next = { ...next, progression };
  return next === profile ? profile : { ...next, revision: profile.revision + 1 };
}
// The three actions a screen may dispatch at the analytics record, mapped to reduceAnalytics inputs.
const ANALYTICS_ACTIONS = Object.freeze({
  'analytics-open': () => ({ type: 'open' }),
  'analytics-beat': (a) => ({ type: 'beat', ms: a.ms }),
  'analytics-count': (a) => ({
    type: 'count',
    rounds: a.rounds,
    matches: a.matches,
    cards: a.cards,
    quests: a.quests,
  }),
});
function applyAction(profile, action) {
  if (action.type.startsWith('journey-')) {
    const before = profile.journeys || {},
      journeys = reduceExpeditions(before, action);
    if (journeys === before) return profile;
    let next = profile;
    if (action.type === 'journey-answer') {
      const run = journeys[expeditionById(action.routeId).key].run;
      next = applyPractice(profile, {
        at: action.at,
        fact: run.cards[action.index],
        choice: action.choice,
        // reduceExpeditions has already pushed this answer at action.index, and this is the only
        // moment the bet is reachable: the next journey-start overwrites record.run.
        confidence: run.answers[action.index]?.confidence,
        elapsedMs: run.answers[action.index]?.elapsedMs,
        roundId: `journey:${run.id}:${action.index}`,
        // The run is the group the Vault's Runs timeline expands; the card's place in it is the order.
        surface: 'expedition',
        contextId: run.id,
        index: action.index,
      });
    }
    return { ...next, journeys };
  }
  // Analytics is a device-local measurement record and nothing else: it earns no XP, feeds no
  // progression event, and holds no personal data. It only ever moves through reduceAnalytics.
  if (Object.hasOwn(ANALYTICS_ACTIONS, action.type)) {
    const before = profile.analytics || emptyAnalytics();
    const analytics = reduceAnalytics(before, ANALYTICS_ACTIONS[action.type](action), action.at);
    return analytics === profile.analytics ? profile : { ...profile, analytics };
  }
  if (action.type === 'practice') return applyPractice(profile, action);
  // The Supporter Card: allegiance, handle, age band. Device-local, never a progression event.
  if (action.type === 'supporter') return applySupporter(profile, action.op, action.at);
  if (action.type === 'cosmetic-buy' || action.type === 'cosmetic-equip') {
    const progression = reduceCosmetics(profile.progression || emptyProgression(), action, action.at);
    return progression === profile.progression ? profile : { ...profile, progression };
  }
  let next = profile,
    p = profile.passport;
  if (action.type === 'room') {
    const room = action.room;
    if (!room) return profile;
    const journal = recordRoom(profile.journal, room, action.at);
    if (journal !== profile.journal) next = { ...next, journal };
    // A newly filed complete match rates the sport once. The journal's match ledger is the
    // exactly-once guard, so a re-dispatched room (or a re-poll) cannot rate the same duel twice.
    if (
      room.phase === 'complete' &&
      journal !== profile.journal &&
      !profile.journal.matches.some((m) => m.id === room.id) &&
      journal.matches.some((m) => m.id === room.id)
    ) {
      const sport = roomSport(room);
      if (sport)
        next = applySupporter(
          next,
          {
            type: 'duel-result',
            sport,
            outcome: room.winner === null ? 'draw' : room.winner === room.seat ? 'win' : 'loss',
            opponent: room.players.some((p) => p?.kind === 'bot') ? 'bot' : 'human',
            at: action.at,
            tzOffsetMinutes: action.tzOffsetMinutes,
          },
          action.at,
        );
    }
    for (const fact of journal.rounds) {
      if (
        fact.matchId === room.id &&
        text(fact.factId) &&
        Object.hasOwn(TOPIC_DOMAINS, fact.topic) &&
        !Object.hasOwn(p.facts, fact.factId) &&
        Object.keys(p.facts).length < FACT_LIMIT
      )
        p = {
          ...p,
          facts: { ...p.facts, [fact.factId]: { topic: fact.topic, opened: false, recalled: false } },
        };
    }
    if (
      room.phase === 'complete' &&
      modes.includes(room.config?.mode) &&
      (!p.played || !p.modes.includes(room.config.mode))
    )
      p = { ...p, played: true, modes: [...new Set([...p.modes, room.config.mode])] };
  }
  if (['open', 'recall', 'save'].includes(action.type)) {
    // Only a fact the journal actually holds can generate review activity — but "holds" now means the
    // card store as well as the round window, so a Save on a fact met 300 rounds ago still saves.
    const fact = vaultFact(profile.journal, action);
    if (!fact) return profile;
    if (action.type === 'save') {
      const saved = profile.journal.saved.includes(fact.question)
        ? profile.journal.saved.filter((q) => q !== fact.question)
        : [fact.question, ...profile.journal.saved].slice(0, 200);
      next = { ...next, journal: { ...next.journal, saved } };
    } else {
      const field = action.type === 'open' ? 'opened' : 'recalled',
        global = action.type === 'open' ? 'openedAny' : 'recalledAny';
      const known = fact.factId && p.facts[fact.factId];
      if (!p[global] || (known && !known[field]))
        p = {
          ...p,
          [global]: true,
          ...(known ? { facts: { ...p.facts, [fact.factId]: { ...known, [field]: true } } } : {}),
        };
    }
  }
  // The Recall Lab dispatches this instead of `recall`. Its journal half, the attempt record and the
  // box/due move, belongs to the review schedule; the fact ledger the missions count is still
  // passport's, and a Lab that stopped moving it would silently strand "Try 3 distinct untimed
  // questions". The id travels on the action rather than through a journal.rounds lookup, because the
  // Vault lists facts whose round may have rolled out of the 200-round window.
  if (action.type === 'review' && factKey(action.factId)) {
    const journal = applyReview(next.journal, action);
    if (journal !== next.journal) next = { ...next, journal };
    const known = p.facts[action.factId];
    if (!p.recalledAny || (known && !known.recalled))
      p = {
        ...p,
        recalledAny: true,
        ...(known ? { facts: { ...p.facts, [action.factId]: { ...known, recalled: true } } } : {}),
      };
  }
  // §3.5's other half: the deck a bad run hands the Vault. It is the primary action out of a run that
  // finished below zero, so it has to be a write the player can trust — it moves `due` and the deck's
  // order, and nothing else. Re-reading a fact is not answering it, and the box ladder is what an answer
  // earned; a seed that advanced a box would pay for reading the answer, which `revealed` already forbids
  // on the attempt side. No passport flag moves either: seeding is not recalling. And because `due` is
  // itself the gate the review XP is paid against, the seed is rate limited to one look per card per
  // local day — see applySeed.
  if (action.type === 'review-seed') {
    const journal = applySeed(next.journal, action);
    if (journal !== next.journal) next = { ...next, journal };
  }
  if (action.type === 'report') {
    const fact = vaultFact(profile.journal, action);
    if (
      !fact ||
      !['incorrect', 'ambiguous', 'source', 'other'].includes(action.reason) ||
      typeof action.note !== 'string' ||
      action.note.length > 800
    )
      return profile;
    const id = `issue:${fact.id}:${action.reason}`;
    const existing = (profile.issues || []).find((i) => i.id === id);
    if (existing && existing.note === action.note.trim()) return profile;
    next = {
      ...next,
      issues: [
        { id, fact: { ...fact }, reason: action.reason, note: action.note.trim(), at: action.at },
        ...(profile.issues || []).filter((i) => i.id !== id),
      ].slice(0, 50),
    };
  }
  if (action.type === 'skin' && passportSummary(p).skins.includes(action.skin) && p.skin !== action.skin)
    p = { ...p, skin: action.skin };
  if (p !== profile.passport) next = { ...next, passport: p };
  return next;
}
/** The card reducer plus the one derived write: the moment all seven steps are done is stamped once. */
function applySupporter(profile, op, at) {
  const before = profile.supporter || emptySupporter();
  let supporter = reduceSupporter(before, op, at);
  if (supporter.completedAt === null) {
    const progress = cardProgress(supporter, { ...profile, supporter });
    if (progress.done === progress.total) supporter = reduceSupporter(supporter, { type: 'complete' }, at);
  }
  return supporter === profile.supporter ? profile : { ...profile, supporter };
}
/** The sport a finished room was about: the majority topic of its rounds, else the configured topic. */
function roomSport(room) {
  const tally = new Map();
  for (const r of [...(Array.isArray(room.completedRounds) ? room.completedRounds : []), room.round]) {
    const sport = sportOfTopic(r?.question?.topic);
    if (sport) tally.set(sport, (tally.get(sport) || 0) + 1);
  }
  let best = null,
    n = 0;
  for (const [sport, count] of tally)
    if (count > n) {
      best = sport;
      n = count;
    }
  return best || sportOfTopic(room.config?.topic);
}
// ---------------------------------------------------------------------------------------------------
// The Vault's capture half. Three records, three jobs: `cards` holds the content once, `facts` holds the
// learning aggregates that are never evicted, and `attempts` holds the rolling tail of what actually
// happened. `passport.facts` is left alone — it is the exactly-once award ledger deriveEvents diffs, and
// giving it a second job would break the identity contract the whole profile layer rests on.

/** The content snapshot, stored once per fact by whichever presentation journalled it first. */
function cardSnapshot(f) {
  const difficulty = DIFFICULTIES.includes(f.difficulty) ? { difficulty: f.difficulty } : {};
  return {
    question: f.question,
    options: [...f.options],
    correctIndex: f.correctIndex,
    explanation: f.explanation,
    topic: f.topic,
    subtopic: f.subtopic,
    sourceUrl: f.sourceUrl,
    sourceLabel: f.sourceLabel,
    ...difficulty,
  };
}

/**
 * The learning record. Aggregates here are never evicted, so they stay true after the rolling attempt
 * tail has dropped the attempt that produced them — which is exactly why `firstMissAt` and `recoveredAt`
 * are stored rather than counted back out of `attempts` when the Vault's claim tile asks. Both are
 * write-once and day-ordered: missed and recovered inside one local day is not a recovery.
 */
function nextFact(prior, { topic, difficulty, correct, surface, confidence, revealed, at }) {
  const days = nextDays(prior, correct, at);
  const firstMissAt = prior?.firstMissAt ?? (correct ? null : at);
  const kind = DIFFICULTIES.includes(difficulty) ? difficulty : prior?.difficulty;
  // Bold and Called are the calls the player was sure about; a miss at either is the highest-value card
  // the review queue will ever hold. The tier's own `order` says which those are, so this never has to
  // name a tier and never has to be edited when a fourth one arrives.
  const risked = Object.hasOwn(CONFIDENCE, confidence) && CONFIDENCE[confidence].order > 0;
  // The schedule belongs to the Vault alone. A card met in a duel or called in an expedition records in
  // full and sits due immediately, but only an answer given in the review deck may move a box —
  // otherwise the betting mode could retire the queue it is supposed to be filling.
  const schedule =
    surface === 'recall'
      ? nextSchedule(prior ?? emptySchedule(), { correct, revealed, days }, at)
      : prior
        ? {
            box: prior.box ?? 0,
            // `due: null` reads as "due now" to the queue but as "never scheduled" to the progression
            // diff, which pays a review only against a finite `due` it can compare. Meeting a fact is
            // what puts it in the queue, so the writer says that in a number both sides can read.
            //
            // EXCEPT once the fact has passed its audit. `null` on a RETIRED fact is the opposite
            // statement — `isDue` reads it as "out of the queue for good" (AUDIT_DAYS, lib/journal-
            // review.mjs) — so `?? at` there does not schedule a card, it resurrects one the ladder
            // has closed, and the next Vault answer moves `due` back to null and is paid as an
            // advance. Repeat per duel or expedition answer, for ever. A retired fact keeps whatever
            // look it has left: its pending audit, or none.
            due: Number.isFinite(prior.retiredAt) ? (prior.due ?? null) : (prior.due ?? at),
            lapses: prior.lapses ?? 0,
            retiredAt: prior.retiredAt ?? null,
          }
        : { ...emptySchedule(), due: at };
  return {
    topic,
    ...(kind ? { difficulty: kind } : {}),
    seen: (prior?.seen ?? 0) + 1,
    correct: (prior?.correct ?? 0) + (correct ? 1 : 0),
    firstAt: prior?.firstAt ?? at,
    lastAt: at,
    lastCorrect: correct,
    // The day of the last correct answer, so `days` counts distinct days exactly rather than inferring
    // the last one from `lastAt` — an inference that double-counts a correct, miss, correct inside one day.
    correctDay: correct ? dayKey(at) : (prior?.correctDay ?? null),
    streak: correct ? (prior?.streak ?? 0) + 1 : 0,
    days,
    bySurface: {
      ...emptyBySurface(),
      ...prior?.bySurface,
      [surface]: (prior?.bySurface?.[surface] ?? 0) + 1,
    },
    boldWrong: (prior?.boldWrong ?? 0) + (!correct && risked ? 1 : 0),
    firstMissAt,
    recoveredAt:
      prior?.recoveredAt ??
      (correct && firstMissAt !== null && dayDiff(dayKey(firstMissAt), dayKey(at)) > 0 ? at : null),
    ...schedule,
  };
}

/**
 * The one write path into the three new collections. Attempts are PREPENDED and then handed to the same
 * `trimAttempts` the sanitiser calls (R4) — a cap enforced on only one side stops a round-tripped profile
 * deep-equalling the one it came from the first time a player answers one fact thirteen times, which a
 * repeat-until-correct review loop reaches in under a minute. There is deliberately no sort: a whole run
 * is dispatched with a single `at`, so ties are routine and no sort is stable across engines.
 */
function recordAttempt(journal, { attempt, card, factId, record }) {
  const cards = journal.cards || {},
    facts = journal.facts || {},
    list = journal.attempts || [];
  // The same self-check the round entry already gets, for the same reason (R4): a card or an attempt the
  // sanitiser would drop on the next load must not be written now, or a round-tripped profile stops
  // deep-equalling the one it came from and the identity contract the profile layer rests on goes too.
  const clean = readJournalValue({
    version: 1,
    cards: card ? { [factId]: card } : {},
    attempts: [attempt],
  });
  return {
    ...journal,
    cards:
      clean.cards[factId] && !Object.hasOwn(cards, factId) && Object.keys(cards).length < STORE_LIMIT
        ? { ...cards, [factId]: card }
        : cards,
    facts:
      record && (Object.hasOwn(facts, factId) || Object.keys(facts).length < STORE_LIMIT)
        ? { ...facts, [factId]: record }
        : facts,
    attempts: clean.attempts.length ? trimAttempts([attempt, ...list]) : list,
  };
}

/**
 * A card-store entry wearing a round's clothes. §3.3.4: the Vault lists up to 300 facts out of `cards`
 * while `rounds` holds 200 entries, so a fact the player met long enough ago dispatches an action whose
 * round has already rolled out of the window — and today that Save returns the same profile while the UI
 * fires its reward burst anyway. `saved` stays keyed on the question string, so the synthesised entry
 * carries one, and `report` stores an issue payload that still passes the journal's own validator.
 */
function roundFromCard(factId, card, at) {
  const correctAnswer = card?.options?.[card.correctIndex];
  if (typeof correctAnswer !== 'string') return null;
  return {
    id: `card:${factId}`,
    factId,
    ...(DIFFICULTIES.includes(card.difficulty) ? { difficulty: card.difficulty } : {}),
    matchId: 'vault',
    at: Number.isFinite(at) ? at : 0,
    question: card.question,
    // A copy, not the stored array: this entry is handed to the issue log, which outlives the card store.
    options: [...card.options],
    correctAnswer,
    explanation: card.explanation,
    topic: card.topic,
    subtopic: card.subtopic,
    sourceUrl: card.sourceUrl,
    sourceLabel: card.sourceLabel,
    correct: null,
    elapsedMs: null,
    bot: false,
  };
}

/** Find the round this action names, else synthesise it from the card store. Null when neither holds it. */
function vaultFact(journal, action) {
  const rounds = journal.rounds || [];
  const hit = action.roundId
    ? rounds.find((r) => r.id === action.roundId)
    : text(action.factId)
      ? rounds.find((r) => r.factId === action.factId)
      : rounds.find((r) => r.question === action.question);
  if (hit) return hit;
  const cards = journal.cards || {};
  const factId = text(action.factId)
    ? action.factId
    : Object.keys(cards).find((id) => cards[id]?.question === action.question);
  return factId && cards[factId] ? roundFromCard(factId, cards[factId], action.at) : null;
}

/**
 * The Recall Lab's journal half: the attempt, the box move and the aggregates, all inside this one
 * action. The progression diff reads `after.journal.attempts[0]` and compares `facts[id].box` and `.due`
 * against the before-profile, so splitting the two across actions would leave the Vault recording
 * everything and paying nothing.
 */
function applyReview(journal, action) {
  const id = action.factId;
  if (!Number.isFinite(action.at)) return journal;
  const prior = (journal.facts || {})[id] ?? null;
  const stored = (journal.cards || {})[id] ?? null;
  // A profile written before the card store existed holds the content only inside its round window, so
  // the first review of such a fact promotes it into `cards` instead of paying nothing and forgetting it.
  const legacy =
    !stored && !prior
      ? (journal.rounds || []).find((r) => r.factId === id && Array.isArray(r.options))
      : null;
  const card = legacy
    ? cardSnapshot({ ...legacy, correctIndex: legacy.options.indexOf(legacy.correctAnswer) })
    : null;
  const topic = prior?.topic ?? stored?.topic ?? legacy?.topic;
  if (!Object.hasOwn(TOPIC_DOMAINS, topic)) return journal;
  const correct = action.correct === true;
  const record = nextFact(prior, {
    topic,
    difficulty: stored?.difficulty ?? legacy?.difficulty,
    correct,
    surface: 'recall',
    confidence: null,
    revealed: action.revealed === true,
    at: action.at,
  });
  // `seen` is post-increment, so two reviews of one fact inside a single millisecond — which a test
  // dispatching a whole session at `at: 1000` produces routinely — still get distinct ids and both land.
  const attemptId = text120(action.roundId) ? action.roundId : `review:${id}:${action.at}:${record.seen}`;
  if ((journal.attempts || []).some((a) => a.id === attemptId)) return journal;
  return recordAttempt(journal, {
    factId: id,
    record,
    card,
    attempt: {
      id: attemptId,
      factId: id,
      at: action.at,
      surface: 'recall',
      // The Runs timeline groups attempts by contextId. A Vault session is a day of cards rather than a
      // room or a run, so the day key is the honest grouping and not an invented session id.
      contextId: text64(action.contextId) ? action.contextId : `review:${dayKey(action.at)}`,
      index: idx32(action.index),
      chose: text500(action.chose) ? action.chose : null,
      correct,
      elapsedMs: null,
      confidence: null,
      stake: null,
      opponent: null,
      revealed: action.revealed === true,
    },
  });
}

/**
 * Has this fact already had its paid look in the Vault today? The seed's rate limit turns on this and
 * on nothing else, so it asks the attempt log — the one record that carries both a SURFACE and a time.
 *
 * `facts[id].lastAt` cannot answer it: every surface writes that field, so the expedition answer that
 * produced the miss stamps it seconds before the deck is dispatched, and a `lastAt` guard fires on
 * precisely the cards §3.5 exists to hand over — silently, for any fact the player has ever reviewed.
 *
 * The log is trimmed (R4), so absence of a recall attempt is only evidence back as far as the tail
 * reaches. Attempts are stored newest-first; when this fact's own slice is already at ATTEMPTS_PER_FACT
 * and even its oldest entry is today's — or the whole 600-deep log is today's — a recall attempt from
 * today could have been evicted, the log can no longer prove it did not happen, and the answer is
 * "yes". Refusing a seed costs one card its place in today's deck; the other direction reopens the tap.
 */
function reviewedToday(attempts, id, at) {
  const list = Array.isArray(attempts) ? attempts : [];
  const key = dayKey(at);
  if (list.length >= ATTEMPTS_TOTAL && dayKey(list[list.length - 1].at) === key) return true;
  let n = 0;
  let oldest = null;
  for (const a of list) {
    if (a.factId !== id) continue;
    if (a.surface === 'recall' && dayKey(a.at) === key) return true;
    n += 1;
    oldest = a;
  }
  return n >= ATTEMPTS_PER_FACT && oldest !== null && dayKey(oldest.at) === key;
}

/**
 * The seeded deck's journal half: precisely these facts, due at `at`, in the order the deck ranked them,
 * and not one other field touched.
 *
 * `seedDeck` owns the ordering and the cap so the queue and the deck cannot disagree about either; all
 * this adds is the write, and the write is deliberately the smallest one that can exist. A fact the
 * journal has never met is SKIPPED rather than invented — the seed moves a schedule, it does not meet a
 * card, and a record with no topic and no content is one the sanitiser would drop on the next load.
 *
 * TWO things are written, and they are different in kind. `facts[id].due` is membership: these cards are
 * in the queue now. `journal.seed` is ORDER: the Vault's own `priority` sorts on the LIFETIME `boldWrong`
 * counter, so a card called-and-missed in some earlier run outranks this run's fresh Called miss, and
 * §3.5's "Bold and Called misses first" loses to history. The deck is stored so the Vault can play THIS
 * run's ranking; nothing else in the profile can express it.
 *
 * Identity when nothing moves, including a re-seed of the same ids at the same instant: five suites
 * assert `readProfile(JSON.parse(JSON.stringify(p)))` deep-equals `p`, and a reducer that returned a
 * fresh object for a no-op would bump the revision on every press of a button that changed nothing.
 */
function applySeed(journal, action) {
  // The clock is the dispatcher's (`action.at`); `seedAt` is the caller's explicit override, which is
  // the only way a seed can be pinned to an instant, since app/use-player.ts stamps `at` itself.
  const at = Number.isFinite(action.seedAt) ? action.seedAt : action.at;
  if (!Number.isFinite(at) || at < 0 || at > 8.64e15) return journal;
  const facts = journal.facts || {};
  const kept = [];
  let seeded = null;
  for (const id of seedDeck(action.factIds, at).factIds) {
    // factKey as well as hasOwn: `facts['__proto__']` is not an own property, and assigning it on the
    // copy would move a prototype rather than a due date.
    if (!factKey(id) || !Object.hasOwn(facts, id)) continue;
    const f = facts[id];
    // A fact that has PASSED its audit has left the queue for good. A seed moves a due date; it does
    // not overrule the ladder's terminal state, and resurrecting an audited card is the other door
    // into the same tap the rate limit below closes (its `due` is null, so the next Vault answer sets
    // it back to null and is paid as an advance — every day, for ever). A retirement whose audit is
    // still pending carries a finite `due` and seeds normally: that look has not been spent.
    if (Number.isFinite(f.retiredAt) && f.due === null) continue;
    // THE RATE LIMIT, and the whole reason this is not a free XP tap. `due` is the gate lib/progression
    // pays a review against (`e.due && e.advanced`), and a seed sets `due = at` on demand — so without
    // this line seed -> answer -> seed -> answer pays XP.reviewCorrect every cycle, for ever, with the
    // box frozen at MAX_BOX and `due` still moving from the seeded instant out to the ladder's next
    // look. A card already REVIEWED in the Vault today keeps the look its ladder gave it: one paid look
    // per card per local day is exactly the ceiling §3.7 costed. Reviewed, not merely answered — the
    // miss a run hands over was answered today by definition, so a limit keyed on the last answer on
    // ANY surface would refuse the whole §3.5 deck. See reviewedToday.
    if (reviewedToday(journal.attempts, id, at)) continue;
    kept.push(id);
    if (f.due === at) continue;
    seeded = seeded || { ...facts };
    seeded[id] = { ...f, due: at };
  }
  // `seeded` is only ever set after a push, so an empty deck cannot have written a due date either.
  if (!kept.length) return journal;
  const prior = journal.seed;
  const same =
    !!prior &&
    prior.at === at &&
    prior.factIds.length === kept.length &&
    prior.factIds.every((id, i) => id === kept[i]);
  if (!seeded && same) return journal;
  return { ...journal, facts: seeded ?? facts, seed: same ? prior : { at, factIds: kept } };
}

// One untimed attempt (Discovery card or expedition card): journals it once and marks the fact recalled.
// Shared by the practice action and the journey-answer branch so the progression hook runs once.
export function applyPractice(profile, action) {
  if (profile.journal.rounds.some((r) => r.id === action.roundId)) return profile;
  const f = action.fact;
  if (
    !f ||
    !Number.isInteger(action.choice) ||
    action.choice < 0 ||
    action.choice > 3 ||
    !Number.isInteger(f.correctIndex) ||
    !Object.hasOwn(TOPIC_DOMAINS, f.topic) ||
    !text(f.factId)
  )
    return profile;
  const chose = f.options?.[action.choice];
  const entry = {
    id: action.roundId,
    matchId: 'practice',
    at: action.at,
    factId: f.factId,
    ...(DIFFICULTIES.includes(f.difficulty) ? { difficulty: f.difficulty } : {}),
    question: f.question,
    options: f.options,
    correctAnswer: f.options[f.correctIndex],
    explanation: f.explanation,
    topic: f.topic,
    subtopic: f.subtopic,
    sourceUrl: f.sourceUrl,
    sourceLabel: f.sourceLabel,
    correct: action.choice === f.correctIndex,
    // The two fields the journal boundary used to drop. The pick is stored as the option TEXT, never
    // an index: every run reshuffles the options, so an index would name a different answer on replay.
    confidence: Object.hasOwn(CONFIDENCE, action.confidence) ? action.confidence : null,
    chose: text500(chose) ? chose : null,
    elapsedMs: Number.isFinite(action.elapsedMs) && action.elapsedMs >= 0 ? action.elapsedMs : null,
    bot: false,
  };
  if (!readJournalValue({ version: 1, rounds: [entry] }).rounds.length) return profile;
  let journal = { ...profile.journal, rounds: [entry, ...profile.journal.rounds].slice(0, 200) };
  // Discovery dispatches `practice:<session>:<index>` and carries nothing beside it (app/discovery.tsx:86),
  // so the grouping key the Runs timeline needs is read back out of the round id rather than bolted onto
  // a screen this change has no other business in. The expedition branch passes both outright.
  const part = String(action.roundId).split(':');
  const surface = action.surface === 'expedition' ? 'expedition' : 'discovery';
  if (text120(action.roundId) && factKey(f.factId))
    journal = recordAttempt(journal, {
      factId: f.factId,
      card: cardSnapshot(f),
      record: nextFact(profile.journal.facts?.[f.factId] ?? null, {
        topic: f.topic,
        difficulty: f.difficulty,
        correct: entry.correct,
        surface,
        confidence: entry.confidence,
        revealed: false,
        at: action.at,
      }),
      attempt: {
        id: action.roundId,
        factId: f.factId,
        at: action.at,
        surface,
        contextId: text64(action.contextId)
          ? action.contextId
          : text64(part[1])
            ? part[1]
            : action.roundId.slice(0, 64),
        index: Number.isInteger(action.index) ? idx32(action.index) : idx32(Number(part[2])),
        chose: entry.chose,
        correct: entry.correct,
        elapsedMs: entry.elapsedMs,
        confidence: entry.confidence,
        stake: null,
        opponent: null,
        revealed: false,
      },
    });
  let next = { ...profile, journal };
  let p = profile.passport;
  const prior = p.facts[f.factId];
  if ((prior || Object.keys(p.facts).length < FACT_LIMIT) && (!prior || !prior.recalled))
    p = {
      ...p,
      facts: { ...p.facts, [f.factId]: { topic: f.topic, opened: prior?.opened ?? false, recalled: true } },
    };
  if (!p.recalledAny) p = { ...p, recalledAny: true };
  if (p !== profile.passport) next = { ...next, passport: p };
  return next;
}
