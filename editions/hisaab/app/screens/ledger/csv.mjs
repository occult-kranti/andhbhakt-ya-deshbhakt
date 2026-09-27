/**
 * screens/ledger/csv.mjs — the money ledger as a flat table: the column list shared by the CSV and the
 * XLSX downloads (public/downloads/hisaab-money-ledger.{csv,xlsx}) and the test that keeps them current.
 *
 * Plain JavaScript (no TypeScript, no bundler aliases) so node runs it as it ships:
 *   node editions/hisaab/app/screens/ledger/make-downloads.mjs     regenerates both files
 *
 * One row per measure, every field the row holds, the source URL in its own column. Text is verbatim;
 * multi-valued fields are joined with "; ". Party is who governed then — a column, not a verdict.
 * RFC 4180 CSV: CRLF line ends, fields quoted when they hold a comma, quote or line break, and a UTF-8
 * BOM so spreadsheet apps read ₹ and dashes correctly. A value that a spreadsheet would run as a
 * formula (leading =, +, -, @, tab or CR) is prefixed with an apostrophe.
 */
import { STATES } from '../../../bank/schema.mjs';

/** Default for checked-in Pages downloads; standalone builds may generate copies for their host. */
export const DEFAULT_SITE = 'https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/';
export function publicationUrl(value = DEFAULT_SITE) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('HISAAB_PUBLIC_URL must be an HTTPS site URL without credentials, query, or fragment.');
  }
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return url.href;
}
export const SITE = publicationUrl(typeof process !== 'undefined' ? process.env.HISAAB_PUBLIC_URL : undefined);

/** The ledger screen's address. */
export const LEDGER_URL = `${SITE}#/money/ledger`;

/** The money-trail modes' display names (edition.ts MONEY_MODES). */
export const MODE_NAMES = Object.freeze({
  distribution: 'Seedha Khaate Mein (straight into the account)',
  relief: 'Rahat Kosh (the relief fund)',
  'pre-election': 'Chunav Se Pehle (before the vote)',
});

/** 'IN' → 'India-wide (Centre)'; other codes → the charter's state name. */
export const stateLabel = (code) => (code === 'IN' ? 'India-wide (Centre)' : STATES[code] ?? code);

/**
 * The columns, in order: [header, value(row), description]. The description is printed on the XLSX
 * README sheet (the column dictionary).
 * @type {ReadonlyArray<readonly [string, (row: any) => string | number, string]>}
 */
export const CSV_COLUMNS = Object.freeze([
  ['id', (r) => r.id, 'Stable id of the measure: <state code>-<measure>-<year>.'],
  ['launched', (r) => r.launched, 'When the measure was announced, launched or first paid, as the bank dates it (YYYY or YYYY-MM).'],
  [
    'launched_is_approximate',
    (r) => (r.launchedApprox ? 'yes' : ''),
    '"yes" when the bank gives no launch date: "launched" is then the earliest date it gives. Read it as "active by".',
  ],
  ['year', (r) => Number(r.launched.slice(0, 4)), 'The launch year.'],
  ['measure', (r) => r.name, 'Short name of the measure.'],
  ['mode', (r) => r.mode, 'The ledger\'s primary mode: distribution, relief or pre-election.'],
  ['mode_name', (r) => MODE_NAMES[r.mode] ?? r.mode, 'The mode as the app names it.'],
  ['level', (r) => r.level, 'Which government enacted it: Centre or State.'],
  ['state_code', (r) => r.state, 'State code (IN = India-wide). A Union measure sited in one state carries that state.'],
  ['state', (r) => stateLabel(r.state), 'State name.'],
  [
    'governing_party',
    (r) => r.party,
    'The party or coalition that governed at that level when the measure came (NDA or UPA for the Centre; the chief minister\'s party for a state coalition). Not a verdict.',
  ],
  [
    'enacted_by',
    (r) => r.enactedBy.map((e) => `${e.name} (${e.role}, ${e.party})`).join('; '),
    'Who announced, presented, launched or passed it: a public act, not an allegation. Empty when the bank names no one.',
  ],
  ['benefit', (r) => r.benefit, 'What was handed out or decided.'],
  ['reach', (r) => r.reach ?? '', 'How many people, families, accounts or items, with the bank\'s date or qualifier.'],
  [
    'cost',
    (r) => r.annualCost ?? '',
    'The money, with its qualifier ("a year", "(2025-26)", "at launch", "in all"). Figures are not comparable across rows and must not be summed.',
  ],
  ['poll', (r) => r.poll?.label ?? '', 'The election the measure preceded, if a bank item ties it to one.'],
  ['poll_month', (r) => r.poll?.month ?? '', 'Month of that poll (YYYY-MM).'],
  [
    'days_before_poll',
    (r) => (typeof r.poll?.gapDays === 'number' ? r.poll.gapDays : ''),
    'Days from the event the bank names (announcement, cabinet decision or first payment) to the first polling day. Empty when not recorded for this row. Timing only: it does not show cause.',
  ],
  ['poll_result', (r) => r.poll?.result ?? '', 'The official result as the bank states it (ECI figures, through the cited outlet).'],
  ['outcome', (r) => r.outcome, 'What happened next: reach, cost, audits, later changes, and for pre-poll rows the result. Causes are named only when a cited study, survey or court says so.'],
  [
    'package_overlaps_parts',
    (r) => (r.package ? 'yes' : ''),
    '"yes" for a bundle whose parts have rows of their own (Karnataka\'s five guarantees, Telangana\'s six); its costs overlap theirs.',
  ],
  ['tags', (r) => r.tags.join('; '), 'Every money-trail mode the row\'s bank items carry.'],
  ['bank_items', (r) => r.itemIds.join('; '), 'The Andhbhakt ya Deshbhakt question-bank items the row is built from.'],
  [
    'play_links',
    (r) => r.itemIds.map((id) => `${SITE}#/q/${id}`).join(' '),
    'Each bank item as a playable question card in the app.',
  ],
  ['source_label', (r) => r.sourceLabel, 'The row\'s source: "Publisher — title (date)".'],
  ['source_url', (r) => r.sourceUrl, 'A link to the fetched page that states the core fact.'],
]);

export const CSV_HEADERS = Object.freeze(CSV_COLUMNS.map(([h]) => h));

/** One ledger row as a list of cell values, in CSV_COLUMNS order. */
export const csvRecord = (row) => CSV_COLUMNS.map(([, get]) => get(row));

/** One CSV field: formula-safe and quoted when needed. */
export function csvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The whole ledger as CSV text (BOM + header + one line per row, CRLF). Rows keep the order given. */
export function ledgerCsv(rows) {
  const lines = [CSV_HEADERS.map(csvField).join(',')];
  for (const r of rows) lines.push(csvRecord(r).map(csvField).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** 'Sep 2026' for the latest as-of month among the rows' bank items (the README's as-of line). */
export function asOfMonth(rows, itemsById) {
  let latest = '';
  for (const r of rows)
    for (const id of r.itemIds) {
      const a = itemsById.get(id)?.asOf;
      if (typeof a === 'string' && a > latest) latest = a;
    }
  return latest;
}
