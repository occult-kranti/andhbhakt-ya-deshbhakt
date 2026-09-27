#!/usr/bin/env node
/**
 * screens/ledger/make-downloads.mjs — regenerate the money ledger's downloads from the data:
 *
 *   editions/hisaab/public/downloads/hisaab-money-ledger.csv    (this script, via ./csv.mjs)
 *   editions/hisaab/public/downloads/hisaab-money-ledger.xlsx   (./make_xlsx.py, openpyxl)
 *
 * Usage (repo root):  node editions/hisaab/app/screens/ledger/make-downloads.mjs
 * Env:  PYTHON=python3            the interpreter that has openpyxl
 *       HISAAB_PUBLIC_URL        optional absolute HTTPS site URL for the exported play links
 *       HISAAB_DOWNLOADS_OUT     optional output directory, e.g. dist-hisaab-domain/downloads
 *       XLSX_RECALC=<recalc.py>   optional: a LibreOffice recalculation script, so the "By year" sheet's
 *                                 COUNTIFS formulas carry cached values for readers that do not compute
 *                                 (Excel, LibreOffice and Google Sheets compute them on open anyway)
 *
 * Run it whenever editions/hisaab/data/money-ledger.json changes: tests/hisaab-ledger.test.mjs fails
 * when the CSV no longer matches the data, and checks the XLSX's row count and README.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANK } from '../../../bank/index.mjs';
import { asOfMonth, CSV_COLUMNS, CSV_HEADERS, csvRecord, ledgerCsv, LEDGER_URL, SITE } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDITION = path.resolve(HERE, '../../..');
const DATA = path.join(EDITION, 'data/money-ledger.json');
const OUT = process.env.HISAAB_DOWNLOADS_OUT
  ? path.resolve(process.env.HISAAB_DOWNLOADS_OUT)
  : path.join(EDITION, 'public/downloads');
const BASENAME = 'hisaab-money-ledger';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (ym) => {
  const [y, m] = ym.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
};

const rows = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const items = new Map(BANK.map((q) => [q.id, q]));
const asOf = asOfMonth(rows, items);
if (!asOf) throw new Error('No as-of month found: are the ledger rows\' bank items registered?');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, `${BASENAME}.csv`), ledgerCsv(rows));

// ---- the README sheet: facts about the file, counted from the rows ------------------------------------
const count = (fn) => rows.filter(fn).length;
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};
const hosts = new Map();
for (const r of rows) hosts.set(hostOf(r.sourceUrl), (hosts.get(hostOf(r.sourceUrl)) ?? 0) + 1);
const topHosts = [...hosts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const years = rows.map((r) => Number(r.launched.slice(0, 4)));

const readme = {
  title: 'HISAAB DO: Paisa Kahan Gaya? The money ledger, 2000–2026',
  facts: [
    ['Facts as of', `${monthName(asOf)} (the as-of month of the bank items behind the rows: ${asOf})`],
    ['Rows', `${rows.length} measures, one per row on the Ledger sheet (${Math.min(...years)}–${Math.max(...years)})`],
    ['By level', `Centre ${count((r) => r.level === 'Centre')}, State ${count((r) => r.level === 'State')}`],
    [
      'By mode',
      `Seedha Khaate Mein (distribution) ${count((r) => r.mode === 'distribution')}, Rahat Kosh (relief) ${count((r) => r.mode === 'relief')}, Chunav Se Pehle (pre-election) ${count((r) => r.mode === 'pre-election')}`,
    ],
    ['Before a poll', `${count((r) => r.poll)} rows name the election they preceded; ${count((r) => typeof r.poll?.gapDays === 'number')} of them record the gap in days`],
    ['In the app', LEDGER_URL],
    ['Corrections', `Report an error from the app's Rules & Sources page: ${SITE}#/rules`],
  ],
  about: [
    [
      'What it is',
      'One row per measure that handed out public money directly between 2000 and 2026: cash and in-kind transfers, relief funds and disaster money, and the budgets, bills and notifications announced before an election. For each: who announced or passed it, which party governed, the benefit, reach and cost, the poll it preceded with the gap in days and the official result, and what happened next.',
    ],
    [
      'Sources',
      'Every row carries its own source: source_label ("Publisher — title (date)") and source_url, a page that was fetched and states the core fact. Each row is built from HISAAB DO question-bank items (bank_items), which were fact-checked against fetched pages under the edition\'s charter; the ledger adds no new research, and every number in a row appears in its own items. The lanes worked from Union budget speeches and Economic Surveys (indiabudget.gov.in), PRS Legislative Research budget analyses, Finance Commission reports, the Rajya Sabha Standing Committee on Home Affairs (261st report, Disaster Management), PIB and PMO releases, CAG audits (read through reports of their tabling), court records (Indian Kanoon, LiveLaw), peer-reviewed studies, and news reports. Election results are the official results as the bank states them (ECI figures, through the cited outlet).',
    ],
    [
      'Source hosts',
      `Most cited first: ${topHosts
      .slice(0, 12)
      .map(([h, n]) => `${h} ${n}`)
      .join(', ')}; ${topHosts.length} hosts in all.`,
    ],
    [
      'How to read it',
      'governing_party is who governed at that level when the measure came (NDA or UPA for the Centre); it is not a verdict, and the counts reflect what the bank covers, not which party spends more. Costs carry their own qualifiers and are not comparable across rows: do not sum them. The two package rows (Karnataka\'s five guarantees, Telangana\'s six) overlap the rows of their parts. A "yes" in launched_is_approximate means "active by", not "launched in".',
    ],
    [
      'Timing, not cause',
      'days_before_poll and poll_result record when a measure came and what the official result was. They do not show that the measure changed the result, and no row claims what caused an election result. Words such as "freebie" or "revdi" appear only where a row quotes whoever said them.',
    ],
    [
      'Sheets',
      'Ledger: the rows (filter and sort freely). By year: measures per launch year by mode and level, as COUNTIFS formulas over the Ledger sheet. README: this sheet.',
    ],
  ],
  columns: CSV_COLUMNS.map(([h, , d]) => [h, d]),
};

// ---- the XLSX, through openpyxl --------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hisaab-ledger-'));
const input = path.join(tmp, 'ledger.json');
const xlsx = path.join(OUT, `${BASENAME}.xlsx`);
fs.writeFileSync(input, JSON.stringify({ headers: CSV_HEADERS, rows: rows.map(csvRecord), readme }));
const py = spawnSync(process.env.PYTHON || 'python3', [path.join(HERE, 'make_xlsx.py'), input, xlsx], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
if (py.status !== 0) throw new Error(`make_xlsx.py failed (${py.status ?? py.error}) — is openpyxl installed?`);

if (process.env.XLSX_RECALC) {
  const rc = spawnSync(process.env.PYTHON || 'python3', [process.env.XLSX_RECALC, xlsx, '60'], { encoding: 'utf8' });
  process.stdout.write(rc.stdout ?? '');
  if (rc.status !== 0 || /"errors_found"|"error"/.test(rc.stdout ?? '')) throw new Error('Recalculation reported a problem.');
}
console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), OUT)}/${BASENAME}.{csv,xlsx} (as of ${asOf}).`);
