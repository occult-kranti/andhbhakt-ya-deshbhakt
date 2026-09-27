/**
 * HISAAB DO — "Paisa Kahan Gaya?", the money ledger (#/money/ledger): the data shaping in
 * editions/hisaab/app/screens/ledger/lib.ts (dates, sorting, filters and their URL form, facet counts,
 * the empty-state hint, the year chart, the before-the-vote groups and gap bands), the flat table in
 * csv.mjs, and the downloads in editions/hisaab/public/downloads/ (the CSV must match the data byte for
 * byte; the XLSX must hold every row, a README with the as-of date and sources, and its sheets).
 *
 * Counts are checked against the whole ledger as shipped (docs/hisaab/research/money-trail.md §1–§2),
 * so a change to money-ledger.json that is not mirrored in the downloads or the overview shows up here.
 * The TypeScript is loaded as it ships (node strips types; the same resolve hooks as the UI foundation
 * test map '@/' and extensionless imports).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROOT_URL = new URL('../', import.meta.url).href;
register('../editions/hisaab/node-aliases.mjs', import.meta.url);
register(
  `data:text/javascript,${encodeURIComponent(`
    const ROOT = ${JSON.stringify(ROOT_URL)};
    export async function resolve(specifier, context, next) {
      let spec = specifier.startsWith('@/') ? ROOT + specifier.slice(2) : specifier;
      try { return await next(spec, context); } catch (error) {
        if (!(spec.startsWith('.') || spec.startsWith('file:'))) throw error;
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          try { return await next(spec + ext, context); } catch {}
        }
        throw error;
      }
    }`)}`,
);

const LEDGER = path.join(ROOT, 'editions/hisaab/data/money-ledger.json');
const DOWNLOADS = path.join(ROOT, 'editions/hisaab/public/downloads');
const ROWS = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
const lib = await import('../editions/hisaab/app/screens/ledger/lib.ts');
const csv = await import('../editions/hisaab/app/screens/ledger/csv.mjs');
const { BANK } = await import('../editions/hisaab/bank/index.mjs');

const count = (fn) => ROWS.filter(fn).length;
const F = (patch = {}) => ({ ...lib.NO_FILTERS, ...patch });

// ---------------------------------------------------------------------------------------------------
// The data the screen stands on

test('the ledger as shipped: 389 rows whose bank items exist and whose source their items cite', () => {
  assert.equal(ROWS.length, 389);
  const byId = new Map(BANK.map((q) => [q.id, q]));
  for (const r of ROWS) {
    assert.ok(r.itemIds.length > 0, `${r.id} has bank items`);
    for (const id of r.itemIds) assert.ok(byId.has(id), `${r.id}: bank item ${id} exists (its card link is #/q/${id})`);
    // The row's ↗ link is a page its own bank items cite (the item's main source, or one of its
    // `sources` when a later bank edit promoted a newer page to the main slot).
    assert.ok(
      r.itemIds.some((id) => [byId.get(id).sourceUrl, ...(byId.get(id).sources ?? [])].includes(r.sourceUrl)),
      `${r.id}: sourceUrl is cited by one of its bank items`,
    );
    assert.ok(lib.LEDGER_MODES.includes(r.mode) && lib.LEDGER_LEVELS.includes(r.level), `${r.id}: mode and level are known`);
    assert.match(r.launched, /^\d{4}(-\d{2})?$/);
    if (r.poll) assert.ok(r.poll.result, `${r.id}: a poll carries its official result`);
  }
  assert.equal(new Set(ROWS.map((r) => r.id)).size, ROWS.length, 'ids are unique');
});

// ---------------------------------------------------------------------------------------------------
// Dates and order

test('dates: a year-only row sorts before that year’s months; "by" marks an approximate date', () => {
  assert.equal(lib.launchKey({ launched: '2023' }), '2023-00');
  assert.equal(lib.launchKey({ launched: '2023-06' }), '2023-06');
  assert.equal(lib.launchedText({ launched: '2023-06' }), 'Jun 2023');
  assert.equal(lib.launchedText({ launched: '2023' }), '2023');
  assert.equal(lib.launchedText({ launched: '2000', launchedApprox: true }), 'by 2000');
  assert.equal(lib.monthText('2023-11'), 'Nov 2023');
  assert.equal(lib.gapText(160), '160 days before polling');
  assert.equal(lib.gapText(1), '1 day before polling');
  assert.equal(lib.gapText(1234), '1,234 days before polling');
  assert.equal(lib.gapText(undefined), null);

  const old = lib.sortRows(ROWS, 'old');
  assert.deepEqual(
    old.map((r) => r.id),
    ROWS.map((r) => r.id),
    'oldest-first is the file’s own order (launched, then state, then id)',
  );
  const fresh = lib.sortRows(ROWS, 'new');
  assert.equal(fresh.length, ROWS.length);
  for (let i = 1; i < fresh.length; i++) {
    const a = lib.launchKey(fresh[i - 1]);
    const b = lib.launchKey(fresh[i]);
    assert.ok(a >= b, 'newest first');
    if (a === b) assert.ok(fresh[i - 1].state <= fresh[i].state, 'ties keep state order');
  }
  const before = ROWS.map((r) => r.id).join();
  lib.sortRows(ROWS, 'new');
  assert.equal(ROWS.map((r) => r.id).join(), before, 'sorting never mutates its input');

  const groups = lib.groupByYear(fresh);
  assert.equal(groups.reduce((s, g) => s + g.rows.length, 0), ROWS.length);
  assert.deepEqual(
    groups.map((g) => g.year),
    [...new Set(fresh.map(lib.launchYear))],
    'one group per year, in the order given',
  );
});

test('words: who passed it, where, and the governing chip are the row’s own', () => {
  const ladli = ROWS.find((r) => r.id === 'mp-ladli-behna-2023');
  assert.equal(lib.enactedText(ladli.enactedBy[0]), 'Shivraj Singh Chouhan · Chief Minister, Madhya Pradesh · BJP');
  assert.equal(lib.placeText(ladli), 'State · Madhya Pradesh');
  assert.equal(lib.placeText({ level: 'Centre', state: 'IN' }), 'Centre · India-wide');
});

// ---------------------------------------------------------------------------------------------------
// Filters

test('filters parse from the URL, report what they cannot use, and round-trip', () => {
  const { filters, ignored } = lib.parseFilters(
    { mode: 'pre-election', level: 'STATE', s: 'up', p: 'bjp', era: '2020-2026', q: '  ladli   behna ' },
    ROWS,
  );
  assert.deepEqual(filters, { mode: 'pre-election', level: 'State', state: 'UP', party: 'BJP', era: '2020-2026', q: 'ladli behna' });
  assert.deepEqual(ignored, []);
  assert.deepEqual(lib.filtersQuery(filters), { mode: 'pre-election', level: 'state', s: 'UP', p: 'BJP', era: '2020-2026', q: 'ladli behna' });
  assert.deepEqual(lib.parseFilters(lib.filtersQuery(filters), ROWS).filters, filters, 'round trip');

  const bad = lib.parseFilters({ mode: 'bribes', s: 'XX', p: 'Nobody', era: '1990-1994', level: 'district' }, ROWS);
  assert.deepEqual(bad.filters, lib.NO_FILTERS, 'unknown values never guess');
  assert.deepEqual(bad.ignored.sort(), ['era=1990-1994', 'level=district', 'mode=bribes', 'p=Nobody', 's=XX']);
  assert.equal(lib.parseFilters({ p: 'jd(u)' }, ROWS).filters.party, 'JD(U)', 'parties with brackets match case-insensitively');
  assert.equal(lib.parseFilters({ q: 'x'.repeat(200) }, ROWS).filters.q.length, lib.Q_MAX);
  assert.deepEqual(lib.filtersQuery(lib.NO_FILTERS), {});
  assert.deepEqual(lib.activeFilters(F({ mode: 'relief', q: 'flood' })), ['mode', 'q']);
});

test('filters count what money-trail.md counts: modes, levels, the Centre, eras', () => {
  const n = (patch) => lib.filterRows(ROWS, F(patch)).length;
  assert.equal(n({}), 389);
  assert.equal(n({ mode: 'distribution' }), 137);
  assert.equal(n({ mode: 'relief' }), 95);
  assert.equal(n({ mode: 'pre-election' }), 157);
  assert.equal(n({ level: 'Centre' }), 128);
  assert.equal(n({ level: 'State' }), 261);
  assert.equal(n({ party: 'NDA' }), 94);
  assert.equal(n({ party: 'UPA' }), 34);
  assert.equal(n({ state: 'IN' }), 93);
  assert.deepEqual(
    ['2000-2004', '2005-2009', '2010-2014', '2015-2019', '2020-2026'].map((era) => n({ era })),
    [40, 43, 55, 74, 177],
  );
  assert.equal(n({ era: '2020-2026', mode: 'pre-election' }), 80);
  assert.equal(n({ state: 'TN', mode: 'distribution' }), 11);
  // Every filter is an AND, and each equals a hand count.
  assert.equal(
    n({ level: 'State', party: 'BJP', era: '2020-2026' }),
    count((r) => r.level === 'State' && r.party === 'BJP' && Number(r.launched.slice(0, 4)) >= 2020),
  );
});

test('search: every word must appear; it reaches names, people, parties, states and polls', () => {
  const ids = (q) => lib.filterRows(ROWS, F({ q })).map((r) => r.id);
  assert.ok(ids('ladli behna').includes('mp-ladli-behna-2023'));
  assert.ok(ids('Chouhan').includes('mp-ladli-behna-2023'), 'a person who passed it');
  assert.ok(ids('madhya pradesh assembly 2023').includes('mp-ladli-behna-2023'), 'the poll it preceded');
  assert.ok(ids('LADLI').length >= 1, 'case-insensitive');
  assert.deepEqual(ids('ladli zzzqqq'), [], 'every word must match');
  for (const id of ids('Uttar Pradesh')) assert.ok(ROWS.find((r) => r.id === id));
  assert.ok(ids('Uttar Pradesh').length >= count((r) => r.state === 'UP'), 'a state name finds its rows');
});

test('facets count each option under the OTHER filters, and every known value is listed', () => {
  const f = F({ state: 'MH', mode: 'pre-election' });
  const facets = lib.facetCounts(ROWS, f);
  const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  // The mode menu ignores the mode filter but keeps the state filter.
  assert.equal(facets.all.mode, count((r) => r.state === 'MH'));
  assert.equal(sum(facets.mode), facets.all.mode);
  assert.equal(facets.mode.get('pre-election'), 9);
  // The state menu ignores the state filter but keeps the mode filter; every state is listed.
  assert.equal(facets.all.state, 157);
  assert.equal(sum(facets.state), 157);
  assert.equal(facets.state.size, new Set(ROWS.map((r) => r.state)).size, 'a zero is listed, not dropped');
  assert.equal(facets.state.get('UT'), 0, 'Uttarakhand has no pre-election row: a real zero');
  assert.equal(sum(facets.level), facets.all.level);
  assert.equal(sum(facets.party), facets.all.party);
  assert.equal(sum(facets.era), facets.all.era);
  assert.equal(facets.all.level, lib.filterRows(ROWS, f).length, 'level is not set, so its "all" is the result');

  assert.deepEqual(lib.stateOptions(ROWS)[0], 'IN', 'India-wide first');
  const names = lib.stateOptions(ROWS).slice(1);
  assert.equal(names.length, 30, 'all 30 charter states appear');
  assert.deepEqual(lib.partyOptions(ROWS).length, 33, '33 governing parties or coalitions');
});

test('an empty result names the one filter whose removal helps most, with its true count', () => {
  const f = F({ state: 'UT', mode: 'pre-election', party: 'INC' });
  assert.equal(lib.filterRows(ROWS, f).length, 0);
  const hint = lib.relaxHint(ROWS, f);
  assert.ok(hint, 'a hint');
  const without = (key) => ROWS.filter((r) => lib.matches(r, f, key)).length;
  assert.equal(hint.count, without(hint.key));
  for (const key of lib.activeFilters(f)) assert.ok(without(key) <= hint.count, `${key} would not give more`);
  assert.equal(lib.relaxHint(ROWS, lib.NO_FILTERS), null, 'nothing active, no hint');
  assert.deepEqual(lib.relaxHint(ROWS, F({ q: 'zzzqqq' })), { key: 'q', count: 389 });
});

// ---------------------------------------------------------------------------------------------------
// The charts

test('the year chart: measures per launch year by mode, every year present, totals true', () => {
  const years = lib.yearsFor(lib.NO_FILTERS);
  assert.equal(years.length, 27);
  assert.deepEqual([years[0], years.at(-1)], [2000, 2026]);
  assert.deepEqual(lib.yearsFor(F({ era: '2005-2009' })), [2005, 2006, 2007, 2008, 2009]);
  const c = lib.yearModeCounts(ROWS, years);
  assert.equal(c.reduce((s, y) => s + y.total, 0), 389);
  for (const y of c) assert.equal(y.by.distribution + y.by.relief + y.by['pre-election'], y.total);
  const at = (y) => c.find((x) => x.year === y);
  assert.deepEqual(at(2024), { year: 2024, total: 35, by: { distribution: 11, relief: 4, 'pre-election': 20 } });
  assert.equal(at(2023).total, 34);
  assert.equal(at(2007).total, 4);
  // Rows outside the years asked for are not counted into them.
  assert.equal(lib.yearModeCounts(ROWS, [2005]).reduce((s, y) => s + y.total, 0), count((r) => r.launched.startsWith('2005')));
});

test('before the vote: gap bands and median as money-trail.md states them', () => {
  const s = lib.gapSummary(ROWS);
  assert.equal(s.withPoll, 164);
  assert.equal(s.withGap, 137);
  assert.equal(s.median, 98);
  assert.equal(s.min, 3);
  assert.equal(s.max, 557);
  assert.deepEqual(
    s.bands.map((b) => b.count),
    [8, 52, 43, 28, 6],
  );
  assert.equal(lib.median([]), null);
  assert.equal(lib.median([1, 2, 3, 4]), 2.5);
  const none = lib.gapSummary(ROWS.filter((r) => !r.poll));
  assert.deepEqual([none.withPoll, none.withGap, none.median], [0, 0, null]);
  assert.equal(lib.gapDomain(160), 180);
  assert.equal(lib.gapDomain(557), 600);
  assert.equal(lib.gapDomain(null), 30);
  assert.equal(lib.gapDomain(900), 900);
  assert.deepEqual(lib.gapTicks(180), [0, 30, 90, 180]);
  assert.deepEqual(lib.gapTicks(600), [0, 30, 90, 180, 365, 600]);
});

test('before the vote: one group per poll, newest first, every polled row once, results verbatim', () => {
  const groups = lib.pollGroups(ROWS);
  const polled = ROWS.filter((r) => r.poll);
  assert.equal(groups.reduce((s, g) => s + g.measures.length, 0), polled.length);
  assert.equal(new Set(groups.flatMap((g) => g.measures.map((m) => m.row.id))).size, polled.length);
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].month >= groups[i].month, 'newest poll first');
  for (const g of groups) {
    assert.ok(g.results.length >= 1);
    for (const r of g.results) assert.ok(g.measures.some((m) => m.row.poll.result === r), 'a result line is some row’s own, verbatim');
    const gaps = g.measures.map((m) => m.gapDays);
    const firstNull = gaps.indexOf(null);
    if (firstNull >= 0) assert.ok(gaps.slice(firstNull).every((x) => x === null), 'unrecorded gaps last');
    const known = gaps.filter((x) => x !== null);
    assert.deepEqual(known, [...known].sort((a, b) => a - b), 'nearest polling day first');
  }
  const mp = groups.find((g) => g.label === 'Madhya Pradesh Assembly 2023');
  assert.ok(mp.measures.some((m) => m.row.id === 'mp-ladli-behna-2023' && m.gapDays === 160));
  assert.deepEqual(mp.results, ['BJP won 163 of 230 seats; Congress 66']);

  assert.deepEqual(lib.distinctResults(['BJP won 312 of 403 seats', 'BJP won 312 of 403 seats; SP 47', 'BJP won 312 of 403 seats.']), [
    'BJP won 312 of 403 seats; SP 47',
  ]);
  assert.deepEqual(lib.distinctResults(['TVK won 108 of 234; DMK 59; AIADMK 47 (ECI)', 'TVK won 108 of 234 seats; DMK 59; AIADMK 47']), [
    'TVK won 108 of 234; DMK 59; AIADMK 47 (ECI)',
  ], 'the same parties and numbers, worded twice, print once (the fuller line)');
  assert.deepEqual(
    lib.distinctResults(['Hung House: BJP 104, Congress 78, JD(S) 37', 'Hung: BJP 104, Congress 78, JD(S) 37 of 224', 'Hung House: BJP 104 of 224, Congress 78, JD(S) 37']),
    ['Hung House: BJP 104 of 224, Congress 78, JD(S) 37'],
  );
  assert.deepEqual(lib.distinctResults(['BJP won 312 of 403', 'SP won 312 of 403']), ['BJP won 312 of 403', 'SP won 312 of 403'], 'a different party is a different line');
  assert.deepEqual(
    lib.distinctResults(['Mahayuti won 230 of 288 seats; BJP 132', 'Mahayuti 235 of 288 with allies']),
    ['Mahayuti won 230 of 288 seats; BJP 132', 'Mahayuti 235 of 288 with allies'],
    'lines that differ are all kept, so a difference stays visible',
  );
});

// ---------------------------------------------------------------------------------------------------
// The flat table and the downloads

/** RFC 4180 reader (enough for the file we write). */
function parseCsv(text) {
  const out = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      out.push(row);
      row = [];
      field = '';
      i++;
    } else field += ch;
  }
  if (field || row.length) out.push([...row, field]);
  return out;
}

test('CSV: one record per measure, every column, the source URL in its own column, formula-safe', () => {
  assert.equal(csv.csvField('plain'), 'plain');
  assert.equal(csv.csvField('a, b'), '"a, b"');
  assert.equal(csv.csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csv.csvField('=1+1'), "'=1+1");
  assert.equal(csv.csvField('-5'), "'-5");
  assert.equal(csv.csvField('@x'), "'@x");
  assert.equal(csv.csvField(null), '');
  assert.equal(csv.csvField(0), '0');

  const text = csv.ledgerCsv(ROWS);
  assert.ok(text.startsWith('﻿'), 'UTF-8 BOM for spreadsheet apps');
  assert.ok(text.endsWith('\r\n'));
  const records = parseCsv(text.slice(1));
  assert.deepEqual(records[0], [...csv.CSV_HEADERS]);
  assert.equal(records.length, ROWS.length + 1, 'header + one line per measure');
  const col = (name) => csv.CSV_HEADERS.indexOf(name);
  for (const h of ['id', 'launched', 'measure', 'mode', 'level', 'state', 'governing_party', 'enacted_by', 'benefit', 'reach', 'cost', 'poll', 'days_before_poll', 'poll_result', 'outcome', 'bank_items', 'play_links', 'source_label', 'source_url'])
    assert.ok(col(h) >= 0, `column ${h}`);
  ROWS.forEach((r, i) => {
    const rec = records[i + 1];
    assert.equal(rec.length, csv.CSV_HEADERS.length, `${r.id}: every column`);
    assert.equal(rec[col('id')], r.id);
    assert.equal(rec[col('source_url')], r.sourceUrl);
    assert.equal(rec[col('benefit')], r.benefit, 'text is verbatim');
    assert.equal(rec[col('outcome')], r.outcome);
    assert.equal(rec[col('governing_party')], r.party);
    assert.equal(rec[col('days_before_poll')], typeof r.poll?.gapDays === 'number' ? String(r.poll.gapDays) : '');
    assert.equal(rec[col('poll_result')], r.poll?.result ?? '');
    assert.equal(rec[col('bank_items')], r.itemIds.join('; '));
    assert.equal(rec[col('play_links')].split(' ').length, r.itemIds.length);
    assert.ok(rec[col('play_links')].startsWith(`${csv.SITE}#/q/`));
  });
  const ladli = records.find((rec) => rec[0] === 'mp-ladli-behna-2023');
  assert.equal(ladli[col('enacted_by')], 'Shivraj Singh Chouhan (Chief Minister, Madhya Pradesh, BJP)');
  assert.equal(ladli[col('state')], 'Madhya Pradesh');
  const ui = fs.readFileSync(path.join(ROOT, 'editions/hisaab/app/ui/certificate.tsx'), 'utf8');
  assert.match(ui, /CERT_SITE = absoluteUrl\('#\/'\)/, 'certificate exports follow the current deployment address');
  assert.doesNotMatch(ui, /occult-kranti\.github\.io/, 'certificate exports must not promote another deployment');
});

test('downloads: standalone publication URLs are validated without changing source records', () => {
  assert.equal(csv.publicationUrl(), csv.DEFAULT_SITE);
  assert.equal(csv.publicationUrl('https://hisaab.example'), 'https://hisaab.example/');
  assert.equal(csv.publicationUrl('https://hisaab.example/play'), 'https://hisaab.example/play/');
  for (const url of ['http://hisaab.example/', 'javascript:alert(1)', 'https://user:password@hisaab.example/', 'https://hisaab.example/?q=x', 'https://hisaab.example/#/']) {
    assert.throws(() => csv.publicationUrl(url), undefined, url);
  }
});

test('downloads: the shipped CSV matches the data (regenerate with make-downloads.mjs)', () => {
  const file = path.join(DOWNLOADS, 'hisaab-money-ledger.csv');
  assert.ok(fs.existsSync(file), 'public/downloads/hisaab-money-ledger.csv exists');
  assert.equal(
    fs.readFileSync(file, 'utf8'),
    csv.ledgerCsv(ROWS),
    'the CSV is stale: run `node editions/hisaab/app/screens/ledger/make-downloads.mjs`',
  );
});

/** The entries of a zip archive (stored or deflated), by name. */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  assert.ok(eocd >= 0, 'a zip archive');
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let e = 0; e < entries; e++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files.set(name, method === 8 ? zlib.inflateRawSync(raw).toString('utf8') : raw.toString('utf8'));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

test('downloads: the XLSX holds every row, links sources, and a README with sources and the as-of date', () => {
  const file = path.join(DOWNLOADS, 'hisaab-money-ledger.xlsx');
  assert.ok(fs.existsSync(file), 'public/downloads/hisaab-money-ledger.xlsx exists');
  const files = unzip(fs.readFileSync(file));
  const workbook = files.get('xl/workbook.xml');
  const sheets = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sheets, ['README', 'Ledger', 'By year']);
  const sheetXml = [...files.entries()].filter(([n]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).map(([, x]) => x);
  const lastCol = String.fromCharCode(64 + csv.CSV_HEADERS.length);
  assert.ok(
    sheetXml.some((x) => x.includes(`<dimension ref="A1:${lastCol}${ROWS.length + 1}"`)),
    `the Ledger sheet spans A1:${lastCol}${ROWS.length + 1} (a header + ${ROWS.length} rows)`,
  );
  const strings = files.get('xl/sharedStrings.xml') ?? sheetXml.join('');
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const text = decode(strings);
  const byId = new Map(BANK.map((q) => [q.id, q]));
  const asOf = csv.asOfMonth(ROWS, byId);
  assert.match(asOf, /^\d{4}-\d{2}$/);
  const [y, m] = asOf.split('-');
  const month = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  assert.ok(text.includes('Facts as of'), 'README states the as-of date');
  assert.ok(text.includes(`${month} ${y}`), `README says ${month} ${y}`);
  assert.ok(text.includes('Sources') && text.includes('source_url'), 'README states the sources and the source column');
  assert.ok(text.includes('Timing, not cause'), 'README says the poll gap is timing, not cause');
  for (const h of csv.CSV_HEADERS) assert.ok(text.includes(h), `column ${h} is on the sheet and in the dictionary`);
  const ladli = ROWS.find((r) => r.id === 'mp-ladli-behna-2023');
  assert.ok(text.includes(ladli.sourceUrl), 'a source URL is in the workbook');
  const rels = [...files.entries()].filter(([n]) => /worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(n)).map(([, x]) => x).join('');
  assert.ok((rels.match(/TargetMode="External"/g) ?? []).length >= ROWS.length, 'every source URL is a live link');
});

// ---------------------------------------------------------------------------------------------------
// Wiring and honesty

test('the route: #/money/ledger opens the ledger screen under the Files tab, filters in the query', async () => {
  const { parseHash, href } = await import('../editions/hisaab/app/router.ts');
  const r = parseHash('#/money/ledger?mode=relief&s=UP&v=vote');
  assert.deepEqual([r.name, r.view, r.tab, r.chrome, r.path], ['ledger', null, 'files', 'full', '/money/ledger']);
  assert.deepEqual(r.query, { mode: 'relief', s: 'UP', v: 'vote' });
  assert.equal(parseHash(href.ledger()).name, 'ledger');
  assert.deepEqual(parseHash(href.ledger({ p: 'JD(U)', q: 'flood relief' })).query, { p: 'JD(U)', q: 'flood relief' });
  assert.equal(parseHash('#/money/years').name, 'money', 'the money views still route to money');
  const registry = fs.readFileSync(path.join(ROOT, 'editions/hisaab/app/shell/screens.ts'), 'utf8');
  assert.match(registry, /ledger: lazy\(\(\) => import\('\.\.\/screens\/ledger'\)\)/);
  const hub = fs.readFileSync(path.join(ROOT, 'editions/hisaab/app/screens/money/hub.tsx'), 'utf8');
  assert.match(hub, /href\.ledger\(\)/, 'the money hub links the ledger');
});

test('honesty: the before-the-vote view says timing, not cause; no party colour; no loaded words', () => {
  const dir = path.join(ROOT, 'editions/hisaab/app/screens/ledger');
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  assert.match(read('vote.tsx'), /Timing, not cause\./);
  assert.match(read('vote.tsx'), /It does not show that a measure changed a result/);
  const code = ['index.tsx', 'rows.tsx', 'vote.tsx', 'chart.tsx', 'filters.tsx', 'meta.tsx', 'ledger.css', 'chart.css']
    .map((f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))
    .join('\n');
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/, 'tokens only');
  assert.doesNotMatch(code, /--h-(slot|pass|fail|wait|tape)\b/, 'no verdict or slot colour stands in for a mode or a party');
  assert.doesNotMatch(code, /party[^\n]*(color|background|fill)|(color|background|fill)[^\n]*party/i, 'party never drives a colour');
  assert.doesNotMatch(code, /vote-buying|\bbribe/i, 'no motive words');
  assert.equal((code.match(/freebie|revdi/gi) ?? []).length, 2, 'only the “How to read” note names them (as quoted words)');
});
