/**
 * editions/hisaab/edition.ts — the edition's configuration, typed, in one import for the screens.
 *
 *   import { EDITION, ROUTES, standing, todaysFive } from '@/editions/hisaab/edition';
 *
 * Brand strings, the label ladder over the engine's title bands, the routes (derived from the bank —
 * they are the same objects lib/expeditions.mjs runs, because this build aliases its catalogue), the
 * daily five, and the duel formats. The logic lives in plain modules under engine/ (tested in node);
 * this file only types and gathers it. Only meaningful inside the edition build (vite.config.hisaab.ts):
 * outside it, '@/lib/expeditions.mjs' would be JHK's sports routes.
 */
import { ACTIVE_EXPEDITIONS } from '@/lib/expeditions.mjs';
import { levelForXp, MODE_NAMES } from '@/lib/progression.mjs';
import { MODE_DURATION, MODE_ROUNDS, RULES } from '@/lib/server/room-engine.mjs';
import { QUESTIONS } from './server/bank.mjs';
import { LABELS, labelFor, labelForLevel } from './engine/labels.mjs';
import { DAILY_SIZE, dailyRoundId, dealDaily, localDay } from './engine/daily.mjs';
import { ERAS, MONEY_MIN, MONEY_TAGS, ROUTE_KINDS, ROUTE_MIN, YEAR_MIN, YEAR_SPAN } from './engine/routes.mjs';

/** The deployment base, frozen in by vite.config.hisaab.ts ('/andhbhakt-ya-deshbhakt/' by default). */
declare const __HISAAB_BASE__: string;

export const EDITION = Object.freeze({
  id: 'hisaab',
  name: 'Andhbhakt ya Deshbhakt',
  nameDevanagari: 'अंधभक्त या देशभक्त',
  tagline: 'Show us the accounts.',
  motto: 'Janta ka paisa. Janta ka sawaal.',
  mottoGloss: "The people's money. The people's question.",
  description:
    'A quiz duel about Indian public money: schemes, spending, scams, media and elections — every answer sourced.',
  base: typeof __HISAAB_BASE__ === 'string' ? __HISAAB_BASE__ : '/',
  /** Engine facts a screen quotes. */
  tieMs: RULES.tieMs,
  questionCount: QUESTIONS.length,
});

// ---------------------------------------------------------------------------------------------
// Labels (charter §1): the engine's nine title bands, shown as the edition's nine rungs.

export type Label = { band: number; ordinal: number; from: number; to: number | null; label: string; line: string };
export const LADDER = LABELS as readonly Label[];
export { labelFor, labelForLevel };

/** Everything a level badge needs: the engine's level maths plus the edition's label for the band. */
export function standing(xp: number) {
  const level = levelForXp(xp);
  return { ...level, label: labelFor(level.band) as Label };
}

// ---------------------------------------------------------------------------------------------
// Routes (charter §6): Rajya Rounds, Sector Files, Kiska Media, Forward Court, and the money trail —
// Seedha Khaate Mein, Rahat Kosh, Chunav Se Pehle (from item `tags`) and Saal-dar-Saal (from `year`).

/** A money-trail mode: the item tag its routes are derived from. */
export type MoneyTag = 'distribution' | 'relief' | 'pre-election';
export type RouteKind = 'state' | 'sector' | 'media' | 'forward' | MoneyTag | 'year';
export type Route = Readonly<{
  id: string;
  kind: RouteKind;
  key: string;
  version: number;
  title: string;
  subtitle: string;
  code: string;
  stamp: string;
  chapters: readonly string[];
  domain: 'civics';
  /** The dominant sector (what the engine's per-topic counters file the route under). */
  topic: string;
  /** Every sector the six cards come from. */
  topics: readonly string[];
  ids: readonly string[];
  /** Cards from the route's own pool; the rest (`padded`) are Centre items topping up a small state. */
  ownCount: number;
  padded: readonly string[];
  poolSize: number;
  state?: string;
  sector?: string;
  /** Money-trail routes: the tag the pool was drawn from, and which slice of it. */
  tag?: MoneyTag;
  scope?: 'all' | 'era' | 'state';
  /** Money-trail era routes: the ERAS id, e.g. '2020-2026'. */
  era?: string;
  /** Era and year routes: the inclusive year span of the pool. */
  years?: readonly [number, number];
  /** Year routes: true when thinner adjacent years were merged into one range (the title says so). */
  merged?: boolean;
}>;

/** Every playable route, in display order. Grows as lanes are registered in bank/index.mjs. */
export const ROUTES = ACTIVE_EXPEDITIONS as unknown as readonly Route[];
export const ROUTE_RULES = Object.freeze({
  kinds: ROUTE_KINDS as readonly RouteKind[],
  min: ROUTE_MIN,
  moneyMin: MONEY_MIN as number,
  yearMin: YEAR_MIN as number,
});
export const routeById = (id: string) => ROUTES.find((r) => r.id === id) ?? null;
export const routesOfKind = (kind: RouteKind) => ROUTES.filter((r) => r.kind === kind);

// ---- The money trail (charter §4a, §6) ------------------------------------------------------------

export type Era = Readonly<{ id: string; from: number; to: number; label: string }>;
/** The five eras money-trail routes are cut into: 2000–04, 2005–09, 2010–14, 2015–19, 2020–26. */
export const MONEY_ERAS = ERAS as readonly Era[];
/** The years the money trail and Saal-dar-Saal cover. */
export const MONEY_YEARS = YEAR_SPAN as Readonly<{ from: number; to: number }>;

export type MoneyMode = Readonly<{
  tag: MoneyTag;
  /** Mode name (Latin, Hinglish) and its Devanagari twin for the poster line. */
  title: string;
  titleDevanagari: string;
  /** Plain-English gloss. */
  gloss: string;
  /** One-line brief (charter §6). */
  line: string;
}>;

/** The three money-trail modes, in display order. Copy is draft; the design lane may polish. */
export const MONEY_MODES: readonly MoneyMode[] = Object.freeze(
  [
    {
      tag: 'distribution',
      title: 'Seedha Khaate Mein',
      titleDevanagari: 'सीधे खाते में',
      gloss: 'Straight into the account',
      line: 'Cash and in-kind transfers, 2000–2026: who passed them, which party, what happened.',
    },
    {
      tag: 'relief',
      title: 'Rahat Kosh',
      titleDevanagari: 'राहत कोष',
      gloss: 'The relief fund',
      line: 'Relief funds and disaster money: raised, released, disputed, audited.',
    },
    {
      tag: 'pre-election',
      title: 'Chunav Se Pehle',
      titleDevanagari: 'चुनाव से पहले',
      gloss: 'Before the vote',
      line: 'What was announced, paid or passed in the months before an election, and the result.',
    },
  ].map((mode) => Object.freeze(mode as MoneyMode)),
);
/** Saal-dar-Saal (year by year) — the fourth money-trail screen, over every lane. */
export const YEAR_MODE = Object.freeze({
  title: 'Saal-dar-Saal',
  titleDevanagari: 'साल-दर-साल',
  gloss: 'Year by year',
  line: 'Pick a year, 2000–2026: that year’s cards across every file.',
});

/** The money-trail tags in display order (engine/routes.mjs MONEY_TAGS; same order as MONEY_MODES). */
export const MONEY_TAG_ORDER = MONEY_TAGS as readonly MoneyTag[];
export const moneyMode = (tag: MoneyTag) => MONEY_MODES.find((m) => m.tag === tag) ?? null;
/** Every route of one money-trail mode: 'all' first, then eras, then states (the Centre first). */
export const moneyRoutes = (tag: MoneyTag) => ROUTES.filter((r) => r.kind === tag);
/** Saal-dar-Saal routes, chronological. */
export const yearRoutes = () => ROUTES.filter((r) => r.kind === 'year');
/** The Saal-dar-Saal route holding `year` (a single year or a merged range), if the year has cards. */
export const routeForYear = (year: number) =>
  yearRoutes().find((r) => r.years && year >= r.years[0] && year <= r.years[1]) ?? null;

// ---------------------------------------------------------------------------------------------
// Aaj Ka Hisaab: five a day, same for everyone on the same local date.

export type Card = {
  factId: string;
  domain: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceUrl: string;
  sourceLabel: string;
};

/** Today's five as playable cards (`{ id, day, cards }`). */
export function todaysFive(at: number = Date.now()): { id: string; day: string; cards: Card[] } {
  return dealDaily(localDay(at), QUESTIONS);
}
export { DAILY_SIZE, dailyRoundId, localDay };

// ---------------------------------------------------------------------------------------------
// Duel formats: the engine's own (lib/server/room-engine.mjs). Names from lib/progression.mjs.

export const DUEL_FORMATS = Object.freeze(
  (['quick', 'trilogy', 'gauntlet'] as const).map((mode) =>
    Object.freeze({ mode, name: MODE_NAMES[mode], rounds: MODE_ROUNDS[mode], duration: MODE_DURATION[mode] }),
  ),
);

/**
 * Achievements the engine defines that this edition cannot award (they count sports or science
 * answers). Screens listing achievements should leave them out.
 */
export const UNREACHABLE_ACHIEVEMENTS = Object.freeze(['sports-fan', 'lab-coat']);
