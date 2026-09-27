/**
 * screens/home/home-data.ts — read-only selectors Home needs over the player profile and the routes.
 * Pure (no React, no DOM, no storage): every number Home prints comes from here, from the profile.
 *
 *   receiptStats(journal, now)      { count, today } — unique sourced receipts (the tijori's coins)
 *   dailyStatus(journal, day, n)    today's five: answered, results, done
 *   resumeRun(journeys, routes)     the most recently started file that is not finished
 *   questView(item)                 the edition's words and a destination for an engine quest
 *   fileEntries(journeys)           the records-room and money-trail entry points with real counts
 */
import {
  dailyRoundId,
  moneyRoutes,
  MONEY_MODES,
  routesOfKind,
  YEAR_MODE,
  yearRoutes,
  type MoneyTag,
  type Route,
} from '../../../edition';
import { href } from '../../router';

// ---- receipts (the tijori) ---------------------------------------------------------------------

type RoundLike = { id?: string; factId?: string | null; at?: number; correct?: boolean };
type FactLike = { firstAt?: number | null };
export type JournalLike =
  | {
      rounds?: ReadonlyArray<RoundLike>;
      facts?: Readonly<Record<string, FactLike>>;
    }
  | null
  | undefined;

/** Local midnight of the day holding `now`. */
export function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Receipts collected: one per distinct fact the player has answered anywhere (duel rounds, files,
 * today's five) — the union of the journal's per-fact records and its recent rounds, since duel
 * rounds are journaled without a per-fact record. `today` counts facts first seen since local midnight.
 */
export function receiptStats(
  journal: JournalLike,
  now: number = Date.now(),
): { count: number; today: number } {
  const first = new Map<string, number>();
  const note = (id: string | null | undefined, at: number | null | undefined) => {
    if (!id) return;
    const t = typeof at === 'number' && Number.isFinite(at) ? at : Number.POSITIVE_INFINITY;
    const prev = first.get(id);
    if (prev === undefined || t < prev) first.set(id, t);
  };
  for (const [id, f] of Object.entries(journal?.facts ?? {})) note(id, f?.firstAt ?? null);
  for (const r of journal?.rounds ?? []) note(r.factId, r.at);
  const since = startOfLocalDay(now);
  let today = 0;
  for (const t of first.values()) if (t >= since && Number.isFinite(t)) today += 1;
  return { count: first.size, today };
}

// ---- today's five --------------------------------------------------------------------------------

export type DailyStatus = {
  /** Cards in today's file (5 unless the bank is tiny). */
  size: number;
  /** How many of today's cards are answered. */
  answered: number;
  /** Right/wrong per answered card, in card order (null = not answered yet). */
  results: ReadonlyArray<boolean | null>;
  done: boolean;
  right: number;
};

/** Today's file from the journal: the `practice` rounds filed under dailyRoundId(day, i) (ENGINE §8). */
export function dailyStatus(journal: JournalLike, day: string, size: number): DailyStatus {
  const byId = new Map<string, RoundLike>();
  for (const r of journal?.rounds ?? []) if (r.id) byId.set(r.id, r);
  const results = Array.from({ length: size }, (_, i) => {
    const r = byId.get(dailyRoundId(day, i));
    return r ? r.correct === true : null;
  });
  const answered = results.filter((r) => r !== null).length;
  return {
    size,
    answered,
    results,
    done: size > 0 && answered >= size,
    right: results.filter((r) => r === true).length,
  };
}

// ---- continue where you left ----------------------------------------------------------------------

type RunLike = { id?: string; startedAt?: number; cursor?: number; answers?: ReadonlyArray<unknown> };
type RecordLike = { run?: RunLike | null; folded?: boolean; first?: unknown; bestScore?: number | null };
export type JourneysLike = Readonly<Record<string, RecordLike>> | null | undefined;

export type ResumeRun = { route: Route; answered: number; total: number; startedAt: number };

/** The most recently started file with a run still open (not finished, not folded), or null. */
export function resumeRun(journeys: JourneysLike, routes: readonly Route[]): ResumeRun | null {
  let best: ResumeRun | null = null;
  for (const route of routes) {
    const rec = journeys?.[route.key];
    const run = rec?.run;
    if (!run || rec?.folded || typeof run.cursor !== 'number' || run.cursor >= 6) continue;
    const startedAt = typeof run.startedAt === 'number' ? run.startedAt : 0;
    const answered = Math.min(6, Array.isArray(run.answers) ? run.answers.length : run.cursor);
    if (!best || startedAt > best.startedAt) best = { route, answered, total: 6, startedAt };
  }
  return best;
}

/** How many routes of a list the player has cleared at least once. */
export function clearedCount(journeys: JourneysLike, routes: readonly Route[]): number {
  let n = 0;
  for (const r of routes) if (journeys?.[r.key]?.first) n += 1;
  return n;
}

// ---- quests (Aaj ke 3 kaam) -------------------------------------------------------------------

export type QuestItem = {
  id: string;
  template?: string;
  label: string;
  target: number;
  progress: number;
  xp: number;
  done: boolean;
  topic?: string;
  mode?: string;
};

/**
 * The engine's quest words use JHK's vocabulary (expeditions, Discovery). The edition's display words
 * for the same quest — the engine's id, target and XP are unchanged.
 */
const QUEST_WORDS: Readonly<Record<string, { en: string; hi: string }>> = Object.freeze({
  'answer-3': { en: 'Answer 3 questions correctly', hi: '3 सवाल सही करो' },
  // Both count in the Vault only: 'open' is the engine's first open of a receipt there (receipts/index.tsx),
  // 'save' is a receipt's "Keep a copy" button (receipts/detail.tsx).
  'open-2': { en: 'Open 2 unopened receipts in the Vault', hi: 'वॉल्ट में 2 बिना खुली रसीदें खोलो' },
  'save-2': { en: 'Keep a copy of 2 receipts', hi: '2 रसीदों की कॉपी रखो' },
  'discovery-1': { en: 'Answer one untimed card', hi: 'एक बिना टाइमर वाला कार्ड करो' },
  'expedition-cards-2': { en: 'Answer 2 file cards', hi: 'फ़ाइल के 2 कार्ड करो' },
  'expedition-finish-1': { en: 'Clear a file (all 6 cards)', hi: 'एक फ़ाइल पूरी करो (6 कार्ड)' },
  'correct-6': { en: 'Answer 6 correctly', hi: '6 सही जवाब दो' },
  'review-5': { en: 'Re-check 5 due receipts', hi: '5 रसीदें दोबारा जाँचो' },
  'bold-4': { en: 'Answer 4 file cards correctly', hi: 'फ़ाइल के 4 कार्ड सही करो' },
});

/** Where a quest is done (a link from its row). */
const QUEST_HREF: Readonly<Record<string, string>> = Object.freeze({
  'answer-3': href.aaj(),
  'open-2': href.receipts(),
  'save-2': href.receipts(),
  'discovery-1': href.aaj(),
  'expedition-cards-2': href.files(),
  'expedition-finish-1': href.files(),
  'correct-6': href.files(),
  'review-5': href.receipts(),
  'bold-4': href.files(),
});

/** The template id of an engine quest item (`<day>:<template>` when `template` is absent). */
export const questTemplate = (q: QuestItem) => q.template ?? q.id.split(':').pop() ?? q.id;

/** Words and destination for supported local practice/Vault missions only. */
export function questView(q: QuestItem): { en: string; hi: string; to: string } {
  const template = questTemplate(q);
  const words = QUEST_WORDS[template];
  return { en: words?.en ?? 'Explore practice files', hi: words?.hi ?? 'अभ्यास की फ़ाइलें खोलें', to: QUEST_HREF[template] ?? href.files() };
}

// ---- the entry points ------------------------------------------------------------------------------

export type Entry = {
  id: string;
  /** The typed tab. */
  fno: string;
  title: string;
  titleHi: string;
  /** Plain-English gloss (Hinglish stays Latin in the English locale). */
  gloss: string;
  /** The gloss in Devanagari, for the Hindi locale (drafts for the Hindi review). */
  glossHi: string;
  to: string;
  /** Routes this entry opens onto (0 = none registered yet). */
  files: number;
  /** Of those, cleared at least once. */
  cleared: number;
  /** A span like "2000–2026" where the entry is about years. */
  span?: string;
};

const count = (journeys: JourneysLike, routes: readonly Route[]) => ({
  files: routes.length,
  cleared: clearedCount(journeys, routes),
});

/** The four records-room files (bible §11.2 "four small files"). */
export function recordsEntries(journeys: JourneysLike): Entry[] {
  return [
    {
      id: 'rajya',
      fno: 'F.No. R/IN',
      title: 'Rajya Rounds',
      titleHi: 'राज्य राउंड्स',
      gloss: 'State by state',
      glossHi: 'राज्य-दर-राज्य',
      to: href.files('states'),
      ...count(journeys, routesOfKind('state')),
    },
    {
      id: 'sector',
      fno: 'F.No. X/ALL',
      title: 'Sector Files',
      titleHi: 'सेक्टर फ़ाइलें',
      gloss: 'Kisko mila, kitna mila',
      glossHi: 'किसको मिला, कितना मिला',
      to: href.files('sectors'),
      ...count(journeys, routesOfKind('sector')),
    },
    {
      id: 'media',
      fno: 'F.No. M/OWN',
      title: 'Kiska Media?',
      titleHi: 'किसका मीडिया?',
      gloss: 'Who owns the news',
      glossHi: 'ख़बर किसकी है',
      to: href.files('media'),
      ...count(journeys, routesOfKind('media')),
    },
    {
      id: 'forward',
      fno: 'F.No. C/FWD',
      title: 'Forward Court',
      titleHi: 'फ़ॉरवर्ड अदालत',
      gloss: 'Viral claims, ruled on',
      glossHi: 'वायरल दावे, फ़ैसले के साथ',
      to: href.files('forwards'),
      ...count(journeys, routesOfKind('forward')),
    },
  ];
}

const MONEY_FNO: Readonly<Record<MoneyTag, string>> = Object.freeze({
  distribution: 'F.No. KHAATA',
  relief: 'F.No. RAHAT',
  'pre-election': 'F.No. CHUNAV',
});
const MONEY_GLOSS: Readonly<Record<MoneyTag, string>> = Object.freeze({
  distribution: 'Cash and handouts',
  relief: 'Relief and disaster money',
  'pre-election': 'Months before a vote',
});

const MONEY_GLOSS_HI: Readonly<Record<MoneyTag, string>> = Object.freeze({
  distribution: 'नक़द और सीधी मदद',
  relief: 'राहत और आपदा का पैसा',
  'pre-election': 'वोट से पहले के महीने',
});

/** The money trail, 2000–2026 (charter §4a, §6): three tag modes + Saal-dar-Saal. */
export function moneyEntries(journeys: JourneysLike): Entry[] {
  const years = yearRoutes();
  const spans = years.flatMap((r) => (r.years ? [r.years[0], r.years[1]] : []));
  const span = spans.length ? `${Math.min(...spans)}–${Math.max(...spans)}` : undefined;
  return [
    ...MONEY_MODES.map((m) => ({
      id: m.tag,
      fno: MONEY_FNO[m.tag],
      title: m.title,
      titleHi: m.titleDevanagari,
      gloss: MONEY_GLOSS[m.tag],
      glossHi: MONEY_GLOSS_HI[m.tag],
      to: href.money(m.tag),
      ...count(journeys, moneyRoutes(m.tag)),
    })),
    {
      id: 'years',
      fno: 'F.No. SAAL',
      title: YEAR_MODE.title,
      titleHi: YEAR_MODE.titleDevanagari,
      gloss: YEAR_MODE.gloss,
      glossHi: 'हर साल की अलग फ़ाइल',
      to: href.money('years'),
      span,
      ...count(journeys, years),
    },
  ];
}
