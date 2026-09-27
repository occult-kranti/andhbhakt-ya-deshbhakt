/**
 * screens/rules/corrections.ts — the Corrections log and the change log (design bible §11.17 (10),
 * §8.5 N6: "rule changes are logged in Corrections with a date").
 *
 * Add a correction the day it ships: date · item id · what changed · why · the source that shows it.
 * Never rewrite an old entry; add a new one. Nothing here is invented — an empty log says so.
 */
import { LANES } from '../../../bank/index.mjs';

export type Correction = Readonly<{
  /** 'YYYY-MM-DD' */
  date: string;
  /** The bank item id, e.g. 'hsc001'. */
  id: string;
  change: string;
  why: string;
  /** The page that shows the corrected fact. */
  source: string;
}>;

/** Corrections to bank items, newest first. */
export const CORRECTIONS: readonly Correction[] = Object.freeze([]);

export type ChangeEntry = Readonly<{ date: string; title: string; detail: string }>;

const LANE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  schemes: 'Schemes & benefits',
  spending: 'Budget & spending',
  scams: 'Scams & accountability',
  'states-north': 'States — North & Hindi belt',
  'states-west-south': 'States — West & South',
  'states-east': 'States — East & North-East',
  media: 'Media & speech (Kiska Media?)',
  elections: 'Elections & money',
  forwards: 'Forward Court',
  'dist-centre': 'Distribution — Centre',
  'dist-north': 'Distribution — North & Hindi belt',
  'dist-west-south': 'Distribution — West & South',
  'dist-east': 'Distribution — East & North-East',
  'relief-centre': 'Relief funds — Centre',
  'relief-states': 'Relief funds — States',
  'poll-union': 'Before the vote — Union',
  'poll-states': 'Before the vote — States',
});

/** The files in this build, with their live item counts (read from the bank, never typed by hand). */
export function laneCounts(): Array<{ lane: string; name: string; count: number }> {
  return Object.entries(LANES as Record<string, readonly unknown[]>).map(([lane, items]) => ({
    lane,
    name: LANE_NAMES[lane] ?? lane,
    count: items.length,
  }));
}

/** Changes to the rules and the files, newest first. */
export const CHANGELOG: readonly ChangeEntry[] = Object.freeze([
  {
    date: '2026-09-26',
    title: 'Stopwatch answer rewards',
    detail:
      'The three confidence choices have been replaced by a stopwatch. Correct answers earn 30 XP before 8 seconds, 20 XP from 8 to under 15 seconds, and 10 XP from 15 seconds onward; wrong answers earn 0 answer XP. Daily cards and files have no deadline; duels allow 30 seconds. First-receipt, first-file, match, streak and quest bonuses remain separately recorded. File replays do not award the same answer or completion XP twice. The profile now shows recorded duel accuracy and fastest correct answer.',
  },
  {
    date: '2026-09-26',
    title: 'Streak days need play',
    detail:
      'Opening Andhbhakt ya Deshbhakt no longer counts as a streak day. A day counts when you answer a question, open a receipt in the Vault for the first time, or keep a copy of one. Section 7 of this page said "a day counts when you play" while opening the app still counted; it now states the rule as the game applies it.',
  },
  {
    date: '2026-09-26',
    title: 'Rules page corrected: Surprise Audit, Babu rank and missing XP',
    detail:
      'Section 7 said a Surprise Audit is always announced on the receipt before the round. Round 1 has no receipt before it, so its audit shows on its own receipt; later rounds are announced on the receipt before them. It said a win against a person moves the Babu rank × 1.5; duels with a friend are unranked and only duels against Babu-Bot move it. And it left out XP the game already paid: a new receipt, the first untimed answer, keeping a copy, and Stamp Register stamps. All are listed now, read from the game itself.',
  },
  {
    date: '2026-09-26',
    title: 'Right of reply',
    detail:
      'The report form has a reason for anyone named in a question: "I am named in this question — my reply". A reply is added to the item and logged here.',
  },
  {
    date: '2026-09-26',
    title: 'Share cards carry the legal status on both sides',
    detail:
      'A "challenge" card (the question and four options, no answer) now prints the legal status line and its as-of date too, like the "receipt" card. A card that names a case never travels without its status.',
  },
  {
    date: '2026-09-25',
    title: 'Scoring rules, first version',
    detail: 'The XP table, confidence points, duel formats, the 0.15 s tie and the streak rules as printed in section 7 of this page.',
  },
  {
    date: '2026-09-25',
    title: 'The files open',
    detail: 'The first content lanes went in, each sourced and status-dated as described in sections 2 and 3. The live counts are listed below.',
  },
]);
