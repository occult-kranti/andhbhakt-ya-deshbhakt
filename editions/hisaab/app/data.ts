/**
 * editions/hisaab/app/data.ts — read helpers over the bank and the edition facade, for every screen.
 *
 *   import { itemById, statusLine, sourceKind, stateName, labelDisplay, seatName } from '@/editions/hisaab/app/data';
 *
 * Nothing here writes anything or holds state. Copy that is a legal or honesty rule (status lines,
 * the BOT label, the certificate name rule) lives here once, so no screen re-implements it.
 * Loads in node too (tests/hisaab-ui-foundation.test.mjs): no JSX, no DOM.
 */
import { RANK_TIERS, XP } from '@/lib/progression.mjs';
import { BANK } from '../bank/index.mjs';
import { GOVTS, SECTORS, STATES } from '../bank/schema.mjs';
import { LADDER, labelFor, standing, type Label, type MoneyTag, type Route } from '../edition';
import { COMMON_SURNAMES, GROUP_NAMES, PUBLIC_FIGURES, PUBLIC_NAMES } from './public-names';

/** The label maths from edition.ts, re-exported so screens need one import for label copy. */
export { LADDER, labelFor, labelForLevel, standing, type Label } from '../edition';

// ---- the bank ---------------------------------------------------------------------------------------

export type EnactedBy = Readonly<{ name: string; role: string; party: string }>;
export type Poll = Readonly<{ label: string; month: string; gapDays?: number; result?: string }>;
export type ItemKind = 'scheme' | 'spend' | 'scam' | 'media' | 'funding' | 'forward' | 'institution';
export type Difficulty = 'simple' | 'expert' | 'extreme';

/** One bank item (docs/hisaab/CHARTER.md §3, §3a). Optional fields are absent, never null. */
export type BankItem = Readonly<{
  id: string;
  domain: 'civics';
  region: string;
  state: string;
  topic: string;
  subtopic: string;
  kind: ItemKind;
  difficulty: Difficulty;
  year: number;
  asOf: string;
  govt: string;
  question: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  sourceUrl: string;
  sourceLabel: string;
  sources?: readonly string[];
  status?: string;
  people?: readonly string[];
  tags?: readonly MoneyTag[];
  enactedBy?: readonly EnactedBy[];
  outcome?: string;
  poll?: Poll;
}>;

/** Every registered item (editions/hisaab/bank/index.mjs), typed. */
export const BANK_ITEMS = BANK as unknown as readonly BankItem[];

let byId: Map<string, BankItem> | null = null;
/** A bank item by id (`hsc001`), or null. */
export function itemById(id: string | null | undefined): BankItem | null {
  if (!id) return null;
  if (!byId) byId = new Map(BANK_ITEMS.map((q) => [q.id, q]));
  return byId.get(id) ?? null;
}
/** The bank item behind a dealt card or a revealed duel question (`factId`), or null. */
export const itemForCard = (card: { factId?: string | null } | null | undefined) => itemById(card?.factId ?? null);

// ---- dates and numbers ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09' → 'Sep 2026' (Latin digits in both locales, bible §4.4). Unknown input comes back as is. */
export function monthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
  if (!m) return String(ym ?? '');
  const i = Number(m[2]) - 1;
  return i >= 0 && i < 12 ? `${MONTHS[i]} ${m[1]}` : String(ym);
}

/** 'as of Sep 2026' (en) / 'Sep 2026 तक' (hi). */
export function asOfText(asOf: string, locale: 'en' | 'hi' = 'en'): string {
  return locale === 'hi' ? `${monthLabel(asOf)} तक` : `as of ${monthLabel(asOf)}`;
}

const numberFormat = new Intl.NumberFormat('en-IN');
/** Indian digit grouping (12,34,567), Latin digits in both locales. */
export const formatNumber = (n: number) => numberFormat.format(n);

// ---- legal status (charter §2.2) ---------------------------------------------------------------

/** The item's legal status line, VERBATIM, or null. Never paraphrase, shorten or colour it. */
export const statusLine = (item: BankItem | null | undefined): string | null => item?.status ?? null;
/**
 * The item's one-clause "other side" (charter §2.3: a denial, a contest or a clearance), from the bank's
 * optional `otherSide` field; null when the item has none. The receipt's OTHER SIDE row and the share
 * cards read it here.
 */
export function otherSideOf(item: BankItem | null | undefined): string | null {
  const v = (item as { otherSide?: unknown } | null | undefined)?.otherSide;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * The status line with its date, as it must travel in a share or an aria-label:
 * 'Accused in CBI/ED cases, not tried; … (as of Sep 2026)'. Null when the item has no status.
 */
export function statusWithAsOf(item: BankItem | null | undefined): string | null {
  const line = statusLine(item);
  return line && item ? `${line} (${asOfText(item.asOf)})` : null;
}

// ---- sources ---------------------------------------------------------------------------------------

/**
 * The source-type chip on a receipt (bible §5 `h-chip--source`). The bible's nine, plus OFFICIAL
 * (ministry and scheme portals that are not PIB), FILING (company disclosures, Kiska Media §11.5) and
 * RESEARCH (PRS, ADR, RSF, Media Ownership Monitor…), so no NGO or portal is passed off as a court or
 * a newspaper.
 */
export type SourceKind =
  | 'COURT'
  | 'CAG'
  | 'SANSAD'
  | 'PIB'
  | 'ECI'
  | 'RBI'
  | 'AGENCY'
  | 'OFFICIAL'
  | 'FILING'
  | 'RESEARCH'
  | 'FACT-CHECK'
  | 'PRESS';

export const SOURCE_KINDS: readonly SourceKind[] = Object.freeze([
  'COURT',
  'CAG',
  'SANSAD',
  'PIB',
  'ECI',
  'RBI',
  'AGENCY',
  'OFFICIAL',
  'FILING',
  'RESEARCH',
  'FACT-CHECK',
  'PRESS',
]);

/** What each chip means, for its title/aria text and the Rules page. */
export const SOURCE_KIND_TEXT: Readonly<Record<SourceKind, string>> = Object.freeze({
  COURT: 'A court judgment, order or cause list',
  CAG: 'A Comptroller and Auditor General report',
  SANSAD: 'A Parliament record or answer',
  PIB: 'A Press Information Bureau release',
  ECI: 'Election Commission of India data',
  RBI: 'Reserve Bank of India data',
  AGENCY: 'An investigating or regulating agency (CBI, ED, SEBI, Lokpal)',
  OFFICIAL: 'An official government portal or document',
  FILING: 'A company or stock-exchange filing',
  RESEARCH: 'An independent research or monitoring organisation',
  'FACT-CHECK': 'A fact-checker',
  PRESS: 'A news report',
});

/** 'https://www.thehindu.com/…' → 'thehindu.com' ('' for an unparsable URL). */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
}

const HOSTS: ReadonlyArray<[RegExp, SourceKind]> = [
  [/(^|\.)sci\.gov\.in$|(^|\.)ecourts\.gov\.in$|highcourt|(^|\.)hc[a-z]*\.(nic|gov)\.in$|(^|\.)nclt\.gov\.in$|(^|\.)greentribunal\.gov\.in$/, 'COURT'],
  [/(^|\.)cag\.gov\.in$/, 'CAG'],
  [/(^|\.)sansad\.in$|(^|\.)loksabha\.nic\.in$|(^|\.)rajyasabha\.nic\.in$|(^|\.)eparlib\.nic\.in$|(^|\.)loksabhadocs\.nic\.in$/, 'SANSAD'],
  [/(^|\.)pib\.gov\.in$|(^|\.)pib\.nic\.in$/, 'PIB'],
  [/(^|\.)eci\.gov\.in$/, 'ECI'],
  [/(^|\.)rbi\.org\.in$/, 'RBI'],
  [/(^|\.)cbi\.gov\.in$|(^|\.)enforcementdirectorate\.gov\.in$|(^|\.)ed\.gov\.in$|(^|\.)sebi\.gov\.in$|(^|\.)lokpal\.gov\.in$|(^|\.)cvc\.gov\.in$/, 'AGENCY'],
  [/(^|\.)altnews\.in$|(^|\.)boomlive\.in$|(^|\.)factly\.in$|(^|\.)newschecker\.in$|(^|\.)vishvasnews\.com$|(^|\.)factchecker\.in$|(^|\.)newsmeter\.in$/, 'FACT-CHECK'],
  [/(^|\.)bseindia\.com$|(^|\.)nseindia\.com$|(^|\.)mca\.gov\.in$|(^|\.)ril\.com$|(^|\.)jiostar\.com$/, 'FILING'],
  [/(^|\.)prsindia\.org$|(^|\.)adrindia\.org$|(^|\.)rsf\.org$|mom-gmr\.org$|(^|\.)internetfreedom\.in$|(^|\.)cmsindia\.org$/, 'RESEARCH'],
  // Public broadcasters' news desks are news reports, not government documents.
  [/(^|\.)newsonair\.gov\.in$|(^|\.)ddnews\.gov\.in$/, 'PRESS'],
  [/\.gov\.in$|\.nic\.in$/, 'OFFICIAL'],
];

/** Fact-check sections inside a general outlet (The Quint's WebQoof, India Today's fact check…). */
const FACT_CHECK_PATH = /\/(webqoof|fact-?check|factcheck)(\/|$)/i;

/**
 * The source-type chip for an item (or any `{ sourceUrl, sourceLabel }`), from the URL first; a
 * sourceLabel starting with 'PIB', 'CAG', 'Lok Sabha', 'Rajya Sabha' or 'ECI' decides only when the
 * URL is itself an official host.
 */
export function sourceKind(source: { sourceUrl: string; sourceLabel?: string } | null | undefined): SourceKind {
  if (!source) return 'PRESS';
  const host = sourceHost(source.sourceUrl);
  for (const [pattern, kind] of HOSTS) {
    if (!pattern.test(host)) continue;
    if (kind === 'OFFICIAL') {
      const label = source.sourceLabel ?? '';
      if (/^PIB\b/.test(label)) return 'PIB';
      if (/^CAG\b/.test(label)) return 'CAG';
      if (/^(Lok Sabha|Rajya Sabha|Parliament)\b/.test(label)) return 'SANSAD';
      if (/^(ECI|Election Commission)\b/.test(label)) return 'ECI';
    }
    return kind;
  }
  try {
    if (FACT_CHECK_PATH.test(new URL(source.sourceUrl).pathname)) return 'FACT-CHECK';
  } catch {
    /* unparsable URL: a news report by default */
  }
  return 'PRESS';
}

// ---- states, sectors, the cartogram ------------------------------------------------------------

export type StateCode = keyof typeof STATES;
/** The 30 state codes (charter order), without the Centre. */
export const STATE_CODES = Object.freeze(Object.keys(STATES).filter((c) => c !== 'IN')) as readonly string[];
/** 'UP' → 'Uttar Pradesh'; 'IN' → 'Centre'. Unknown codes come back as given. */
export const stateName = (code: string, opts: { long?: boolean } = {}) =>
  code === 'IN' ? (opts.long ? STATES.IN : 'Centre') : ((STATES as Record<string, string>)[code] ?? code);

/** Devanagari state names for the file brief (draft — a Hindi reader reviews before release). */
export const STATE_NAMES_HI: Readonly<Record<string, string>> = Object.freeze({
  IN: 'केंद्र',
  UP: 'उत्तर प्रदेश',
  UT: 'उत्तराखंड',
  HP: 'हिमाचल प्रदेश',
  PB: 'पंजाब',
  HR: 'हरियाणा',
  DL: 'दिल्ली',
  JK: 'जम्मू-कश्मीर',
  RJ: 'राजस्थान',
  BR: 'बिहार',
  JH: 'झारखंड',
  GJ: 'गुजरात',
  MH: 'महाराष्ट्र',
  GA: 'गोवा',
  MP: 'मध्य प्रदेश',
  CT: 'छत्तीसगढ़',
  KA: 'कर्नाटक',
  KL: 'केरल',
  TN: 'तमिलनाडु',
  AP: 'आंध्र प्रदेश',
  TG: 'तेलंगाना',
  WB: 'पश्चिम बंगाल',
  OD: 'ओडिशा',
  AS: 'असम',
  AR: 'अरुणाचल प्रदेश',
  MN: 'मणिपुर',
  ML: 'मेघालय',
  MZ: 'मिज़ोरम',
  NL: 'नागालैंड',
  SK: 'सिक्किम',
  TR: 'त्रिपुरा',
});
export const stateNameHi = (code: string) => STATE_NAMES_HI[code] ?? stateName(code);

/** The 13 sectors (charter §5), in order. */
export const SECTOR_LIST = SECTORS as readonly string[];
/** Devanagari sector names (draft — a Hindi reader reviews before release). */
export const SECTOR_NAMES_HI: Readonly<Record<string, string>> = Object.freeze({
  'Welfare & Subsidies': 'कल्याण और सब्सिडी',
  'Farm & Food': 'खेती और खाद्य',
  Health: 'स्वास्थ्य',
  'Education & Exams': 'शिक्षा और परीक्षाएँ',
  Infrastructure: 'बुनियादी ढाँचा',
  'Banking & Finance': 'बैंकिंग और वित्त',
  'Energy & Mining': 'ऊर्जा और खनन',
  'Defence & Security': 'रक्षा और सुरक्षा',
  'Elections & Funding': 'चुनाव और चंदा',
  'Media & Speech': 'मीडिया और अभिव्यक्ति',
  'Governance & Institutions': 'शासन और संस्थाएँ',
  'Jobs & Economy': 'रोज़गार और अर्थव्यवस्था',
  'Environment & Land': 'पर्यावरण और ज़मीन',
});

/**
 * The records-room cartogram (bible §11.3): 7 × 7, row by row, `null` for an empty cell. Not a map —
 * it makes no boundary claim. The Centre is a 4-wide drawer at the end of the last row
 * (`CARTOGRAM_CENTRE`), so row 6 lists only its first three cells.
 */
export const CARTOGRAM: ReadonlyArray<ReadonlyArray<string | null>> = Object.freeze([
  [null, null, 'JK', null, null, null, null],
  [null, 'PB', 'HP', 'UT', null, null, 'AR'],
  ['RJ', 'HR', 'DL', 'UP', 'BR', 'SK', 'AS'],
  ['GJ', 'MP', 'CT', 'JH', 'WB', 'ML', 'NL'],
  [null, 'MH', 'TG', 'OD', null, 'TR', 'MN'],
  ['GA', 'KA', 'AP', null, null, null, 'MZ'],
  [null, 'KL', 'TN'],
].map((row) => Object.freeze(row)));
/** Where the Centre drawer sits: row 6, columns 3–6 (0-based), 4 wide. */
export const CARTOGRAM_CENTRE = Object.freeze({ code: 'IN', row: 6, col: 3, span: 4 });

// ---- file numbers ------------------------------------------------------------------------------------

/**
 * The typed tab on a route's file (bible §2.1): 'F.No. S/UP' for a state, 'F.No. X/WEL' for a sector,
 * else the route's own code with tidy slashes ('F.No. MEDIA/KISKA'). One source, so the Files hub and
 * the route player never print two numbers for one file.
 */
export function fileNo(route: Pick<Route, 'kind' | 'code' | 'state'>): string {
  const tail = route.code.split('/').pop()?.trim() ?? route.code;
  if (route.kind === 'state' && route.state) return `F.No. S/${route.state}`;
  if (route.kind === 'sector') return `F.No. X/${tail}`;
  return `F.No. ${route.code.replace(/\s*\/\s*/g, '/')}`;
}

// ---- labels and levels (charter §1, bible §4.5) ------------------------------------------------

export type LabelDisplay = Readonly<{
  band: number;
  ordinal: number;
  /** Devanagari (for the poster line; wrap it in lang="hi"). */
  hi: string;
  /** Latin, as written in the charter (display it uppercase with CSS). */
  en: string;
  /** Aside printed after the Latin label, if any: '(as per the forwards)'. */
  aside?: string;
  /** The aside's Devanagari twin (Hindi locale). */
  asideHi?: string;
  line: string;
  /** The one-liner in Devanagari, for the Hindi locale (drafts — a Hindi reader reviews before release). */
  lineHi: string;
  /** The Hinglish line, Latin script. */
  hinglish: string;
  from: number;
  to: number | null;
}>;

const LABEL_EXTRA: ReadonlyArray<{ hi: string; en: string; aside?: string; asideHi?: string; lineHi: string; hinglish: string }> = [
  { hi: 'अंधभक्त', en: 'Andhbhakt', lineHi: 'पहले फ़ॉरवर्ड। पढ़ना कभी नहीं।', hinglish: 'Forward pehle, padhna kabhi nahi.' },
  {
    hi: 'व्हाट्सऐप यूनिवर्सिटी फ़्रेशर',
    en: 'WhatsApp University Fresher',
    lineHi: 'दाख़िला हो गया। हाज़िरी: हर ग्रुप में।',
    hinglish: 'Admission ho gaya. Har group mein hazri.',
  },
  { hi: 'प्राइम-टाइम लॉयलिस्ट', en: 'Prime-Time Loyalist', lineHi: 'बजट से ज़्यादा एंकर की आवाज़ पहचानते हैं।', hinglish: 'Anchor ki awaaz yaad, budget nahi.' },
  { hi: 'न्यूट्रल अंकल', en: 'Neutral Uncle', lineHi: '“सब चोर हैं।” कौन-कौन, यह जाँचा नहीं।', hinglish: 'Sab chor hain — kaun, yeh check nahi kiya.' },
  { hi: 'रसीद माँगो', en: 'Receipt Maango', lineHi: 'अब बिल माँगने लगे हैं।', hinglish: 'Ab bill maangne lage ho.' },
  { hi: 'आरटीआई योद्धा', en: 'RTI Warrior', lineHi: 'सवाल दायर करते हैं। 30 दिन इंतज़ार करते हैं।', hinglish: 'Sawaal file karo. 30 din ruko.' },
  {
    hi: 'अर्बन नक्सल',
    en: 'Urban Naxal',
    aside: '(as per the forwards)',
    asideHi: '(फ़ॉरवर्ड के मुताबिक़)',
    lineHi: 'मेट्रो में CAG की रिपोर्ट पढ़ते हैं।',
    hinglish: 'Metro mein CAG report padhta hai.',
  },
  { hi: 'टुकड़े-टुकड़े गैंग', en: 'Tukde-Tukde Gang', lineHi: 'करोड़ों को टुकड़ों में गिनते हैं।', hinglish: 'Crore ko tukdon mein ginta hai.' },
  {
    hi: 'सर्टिफ़ाइड एंटी-नेशनल',
    en: 'Certified Anti-National',
    lineHi: 'पैसा कहाँ गया, पता है। फिर भी पूछते हैं।',
    hinglish: 'Paisa kahan gaya, pata hai. Phir bhi poochta hai.',
  },
];

/** Everything a label display needs for a band (clamped to the ladder). */
export function labelDisplay(band: number): LabelDisplay {
  const rung = labelFor(band) as Label;
  const extra = LABEL_EXTRA[rung.band];
  return Object.freeze({ band: rung.band, ordinal: rung.ordinal, from: rung.from, to: rung.to, line: rung.line, ...extra });
}
/** A label's one-liner in the reader's language: English, or its Devanagari twin in the Hindi locale. */
export function labelLine(label: LabelDisplay, isHi: boolean): string {
  return isHi ? label.lineHi : label.line;
}
/** The whole ladder for display, band 0 → 8. */
export const LADDER_DISPLAY: readonly LabelDisplay[] = Object.freeze(LADDER.map((r) => labelDisplay(r.band)));

/** The first-sighting line under Andhbhakt (bible §4.5). */
export const FIRST_LABEL_NOTE = 'Everyone starts here — of anyone, for anything. Receipts get you out.';
/** Its Devanagari twin for the Hindi locale (draft — a Hindi reader reviews before release). */
export const FIRST_LABEL_NOTE_HI = 'सब यहीं से शुरू करते हैं — किसी के भी, किसी भी बात पर। रसीदें ही यहाँ से निकालती हैं।';

/**
 * Goal-gradient copy for the band meter (bible §8.2): "2 levels to Receipt Maango" → "180 XP to
 * Receipt Maango" → "One good file away." At the top rung: "Top rung. Keep asking."
 * `locale: 'hi'` gives the same thresholds in Devanagari ("रसीद माँगो तक 2 लेवल"; drafts for review).
 */
export function goalCopy(xp: number, locale: 'en' | 'hi' = 'en'): string {
  const hi = locale === 'hi';
  const s = standing(xp);
  if (s.band >= LADDER.length - 1) return hi ? 'सबसे ऊँचा पायदान। पूछते रहो।' : 'Top rung. Keep asking.';
  const next = labelDisplay(s.band + 1);
  const levelsLeft = next.from - s.level;
  if (levelsLeft >= 2) return hi ? `${next.hi} तक ${levelsLeft} लेवल` : `${levelsLeft} levels to ${next.en}`;
  const xpLeft = Math.max(0, s.toNext - s.into);
  if (xpLeft <= ONE_FILE_XP) return hi ? 'बस एक अच्छी फ़ाइल दूर।' : 'One good file away.';
  return hi ? `${next.hi} तक ${formatNumber(xpLeft)} XP` : `${formatNumber(xpLeft)} XP to ${next.en}`;
}
/** A first run of six cards answered well pays at least this much XP (lib/progression.mjs XP table). */
const ONE_FILE_XP = 100;

/**
 * Progress through the current band for a five-tick meter: `{ value, max: 5 }`, where each tick is a
 * level of the band (bands are five levels wide; the top band is open-ended and shows full).
 */
export function bandProgress(xp: number): { value: number; max: number } {
  const s = standing(xp);
  if (s.band >= LADDER.length - 1) return { value: 5, max: 5 };
  const first = labelDisplay(s.band).from;
  return { value: Math.min(5, s.level - first + s.progress), max: 5 };
}

// ---- XP log lines in the edition's words (bible §12) -------------------------------------------------

/** One line of `progression.log` (lib/progression.mjs logEntry). */
export type XpLogEntry = Readonly<{ id?: string; at: number; kind: string; xp: number; label: string; meta?: Readonly<Record<string, unknown>> }>;

/**
 * The edition's wording for engine achievements whose JHK text names JHK things (nine sports routes,
 * "facts", "the Vault"). The check behind each is unchanged; only the words follow the edition. One
 * table for the Stamp Register (screens/me), Activity (shell/progression-watch) and XP log lines, so
 * the same stamp never has two names.
 */
export const ACHIEVEMENT_WORDS: Readonly<Record<string, Readonly<{ name?: string; description?: string }>>> = Object.freeze({
  'all-routes': { name: 'Nine files', description: 'Clear nine files (states, sectors or any other).' },
  'bold-master': { name: 'Clean file', description: 'Clear a file six for six.' },
  'scholar-50': { name: 'Receipt clerk', description: 'Collect 50 receipts.' },
  'scholar-200': { name: 'Record keeper', description: 'Collect 200 receipts.' },
  'vault-25': { name: 'Kept copies', description: 'Keep a copy of 25 receipts in the Vault.' },
  'curious-25': { name: 'Reads the noting', description: 'Open 25 receipts in the Vault.' },
  'friend-rival': { description: 'Finish a duel against a friend (room code or two tabs).' },
  'mode-tour': { description: 'Finish Quick Draw, Triple Threat and The Gauntlet.' },
});
/** An achievement's name in the edition's words (the engine's name when the edition keeps it). */
export function achievementName(id: string | null | undefined, engineName: string): string {
  return (id && ACHIEVEMENT_WORDS[id]?.name) || engineName;
}

/**
 * The edition's words for a progression log line. The engine writes JHK's labels ('Expedition card 1 ·
 * correct', 'Discovery · correct', 'New fact', 'Expedition stamped'); every screen that prints XP maps
 * them here, so the words are the same everywhere. `t` picks the Hindi twin in the Hindi locale.
 */
export function xpLogWords(e: XpLogEntry, t: (en: string, hi?: string) => string = (en) => en): string {
  const m = (e.meta ?? {}) as Record<string, unknown>;
  switch (e.kind) {
    case 'expedition-answer': {
      const n = Number(m.index ?? 0) + 1;
      const again = m.fresh === false ? t(' (already met)', ' (पहले मिल चुका)') : '';
      return m.correct ? `${t(`Card ${n} right`, `कार्ड ${n} सही`)}${again}` : `${t(`Card ${n} answered`, `कार्ड ${n} जवाब`)}${again}`;
    }
    case 'discovery':
      return m.correct ? t('Card right', 'कार्ड सही') : t('Card answered', 'कार्ड जवाब');
    case 'fact':
      return e.xp === XP_PER_FACT ? t('New receipt', 'नई रसीद') : t('New receipts', 'नई रसीदें');
    case 'quest':
      return `${t('Quest', 'काम')}: ${e.label}`;
    case 'quests-bonus':
      return t('All three quests done', 'तीनों काम पूरे');
    case 'expedition-complete':
      return m.first ? t('File cleared, first time', 'फ़ाइल पहली बार क्लियर') : t('File finished', 'फ़ाइल पूरी');
    case 'open':
      return t('Source opened', 'सोर्स खोला');
    case 'recall':
      return t('First attempt', 'पहली कोशिश');
    case 'streak':
      return t('Streak', 'स्ट्रीक');
    case 'achievement':
      return `${t('Stamp Register', 'स्टैम्प रजिस्टर')}: ${achievementName(typeof m.achievement === 'string' ? m.achievement : null, e.label)}`;
    default:
      return e.label || e.kind;
  }
}
/** XP for one new fact (lib/progression.mjs XP.fact), to tell "New receipt" from "New receipts". */
const XP_PER_FACT = (XP as { fact: number }).fact;

// ---- duels: seats, the bot, Babu rank ---------------------------------------------------------

/** The practice bot's display name everywhere in this edition (bible §2.1). Always with BOT. */
export const BOT_NAME = 'Babu-Bot · BOT';
/** Its disclosure line — shown wherever the bot is offered or plays. */
export const BOT_LINE = "Picks at random. Can't see the question.";
/** Its Devanagari twin for the Hindi locale (draft — a Hindi reader reviews before release). */
export const BOT_LINE_HI = 'बिना सवाल देखे, रैंडम चुनता है।';
/** The name used when a player has not given one (and on certificates matching a real person). */
export const ANONYMOUS = 'Anonymous Janta';

/** A seat's display name: the bot is always Babu-Bot · BOT, whatever the engine calls it. */
/**
 * True when a name a HUMAN typed would pass for the bot on someone else's screen: 'Babu-Bot · BOT',
 * 'babu bot', 'BOT', 'Lucky Guess · BOT' (the engine's bot). N-rules: only the real bot is labelled BOT,
 * so a human seat never is. 'Robot Raju' or 'Bottle' are fine (BOT must be a word of its own).
 */
export function impersonatesBot(name: string | null | undefined): boolean {
  const n = (name ?? '').normalize('NFKC').toLowerCase();
  const squashed = n.replace(/[^a-z0-9]+/g, '');
  return /(^|[^a-z0-9])bot([^a-z0-9]|$)/.test(n) || squashed.includes('babubot') || squashed.includes('luckyguess');
}

export function seatName(player: { kind?: string; name?: string | null } | null | undefined): string {
  if (!player) return ANONYMOUS;
  if (player.kind === 'bot') return BOT_NAME;
  const name = (player.name ?? '').trim();
  // A human never shows as the bot (a friend typed 'Babu-Bot · BOT'): the neutral name instead.
  if (impersonatesBot(name)) return ANONYMOUS;
  return name || ANONYMOUS;
}

/** Arena rank tiers renamed for the edition (bible §2.1, §12). "On this device" goes beside it. */
export const BABU_RANKS: Readonly<Record<string, string>> = Object.freeze({
  bronze: 'LDC',
  silver: 'Section Officer',
  gold: 'Under Secretary',
  platinum: 'Joint Secretary',
  diamond: 'Secretary',
});
export const babuRank = (tier: string | null | undefined) => BABU_RANKS[tier ?? 'bronze'] ?? BABU_RANKS.bronze;
/** The engine's tiers with the edition's names, low to high. */
export const BABU_RANK_LADDER = Object.freeze(
  (RANK_TIERS as ReadonlyArray<{ id: string; min: number }>).map((t) => Object.freeze({ id: t.id, min: t.min, label: babuRank(t.id) })),
);

// ---- the money trail (charter §3a, §4b) -------------------------------------------------------

/** 'Shivraj Singh Chouhan · Chief Minister, Madhya Pradesh · BJP' — a public act, not an allegation. */
export const enactedLine = (e: EnactedBy) => `${e.name} · ${e.role} · ${e.party}`;

/**
 * The poll line for a pre-election item: 'MP Assembly 2023 · 160 days before polling · BJP won 163 of
 * 230'. Timing is a fact; the line never characterises motive (charter §4b.2). Null without `poll`.
 */
export function pollLine(item: BankItem | null | undefined): string | null {
  const p = item?.poll;
  if (!p) return null;
  const parts = [p.label];
  if (typeof p.gapDays === 'number') parts.push(p.gapDays === 1 ? '1 day before polling' : `${formatNumber(p.gapDays)} days before polling`);
  if (p.result) parts.push(p.result);
  return parts.join(' · ');
}

/** 'Govt then: NDA' — the neutral govt chip text (never a party colour). */
export const govtText = (govt: string) => `Govt then: ${govt}`;

// ---- the certificate name rule (bible §8.4, §8.5) -------------------------------------------------
//
// A certificate puts a label on a typed name and is built to be forwarded, so the name must never be,
// or look like, a real person, a party, an outlet, an institution or a community. The typed name is
// normalised (NFKC, invisible and bidi characters removed, accents and look-alike digits folded),
// Devanagari is transliterated, and it is compared, loosely, against the bank's `people` / `enactedBy`
// and the names in ./public-names.ts. Letters from any script other than Latin and Devanagari (a
// Cyrillic 'а' in 'Nаrendra', small capitals, another Indic script we cannot check) mean the name is
// not printed. When in doubt it prints "Anonymous Janta": a false alarm costs a player their name on
// one certificate; a miss puts a label on a real person.

const HONORIFICS = new Set([
  'shri', 'sri', 'shree', 'smt', 'shrimati', 'shreemati', 'kumari', 'km', 'dr', 'mr', 'mrs', 'ms', 'prof',
  'justice', 'late', 'sir', 'pm', 'cm', 'dy', 'deputy', 'minister', 'mp', 'mla', 'hon', 'honble', 'ji',
  'jee', 'sahab', 'saheb', 'sahib', 'saab', 'bhai', 'bhaiya', 'didi', 'behenji', 'amma', 'anna', 'netaji',
  'shriman', 'sriman', 'madam', 'respected', 'adarniya', 'mananiya', 'maananiya',
]);
/** Titles that point at an office holder even with no name after them ("PM", "CM sahab"). */
const TITLES = new Set(['pm', 'cm', 'dy', 'deputy', 'minister', 'mp', 'mla', 'hon', 'honble', 'justice', 'netaji', 'behenji', 'didi', 'amma']);

/** Invisible, joiner and bidi-control characters: never printed, never compared. */
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ\u{E0000}-\u{E007F}]/gu;
/** Combining accents on Latin letters (not Devanagari signs). */
const LATIN_MARKS = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g;
/** Latin letters with no decomposition that real names use. Any other non-ASCII Latin letter (small
 *  capitals, IPA look-alikes) is not a name we can check. */
const LATIN_EXTRA: Readonly<Record<string, string>> = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ŧ: 't', ħ: 'h', ı: 'i' };
/** Look-alike digits and signs inside a word: 'M0di', 'K3jriwal', 'Pa$$u'. */
const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'l' };
const DEVA = /[ऀ-ॿ꣠-ꣿ]/;

/** The printable form of a typed name: NFKC, invisible/bidi characters removed, spaces collapsed. */
export function cleanName(name: unknown): string {
  return String(name ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Devanagari → Latin (for comparison only) --------------------------------------------------

const DV_CONS: Readonly<Record<string, string>> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n', ट: 't', ठ: 'th', ड: 'd',
  ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', ऩ: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ऱ: 'r', ल: 'l', ळ: 'l', ऴ: 'l', व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h',
  क़: 'q', ख़: 'kh', ग़: 'g', ज़: 'z', ड़: 'r', ढ़: 'rh', फ़: 'f', य़: 'y',
};
const DV_NUKTA: Readonly<Record<string, string>> = { क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f', य: 'y' };
const DV_VOWEL: Readonly<Record<string, string>> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ii', उ: 'u', ऊ: 'uu', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o', ऍ: 'e', ऎ: 'e', ऒ: 'o',
};
const DV_MATRA: Readonly<Record<string, string>> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e', 'ॆ': 'e', 'ॊ': 'o',
};
const DV_LABIAL = new Set(['प', 'फ', 'ब', 'भ', 'म']);

/** A Devanagari word in rough Latin ('नरेंद्र' → 'narendr', 'मोदी' → 'modii'); the final schwa drops. */
export function transliterateDevanagari(word: string): string {
  const cs = Array.from(word.normalize('NFC'));
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (DV_CONS[c] !== undefined) {
      let base = DV_CONS[c];
      let j = i + 1;
      if (cs[j] === '़') {
        base = DV_NUKTA[c] ?? base;
        j++;
      }
      const next = cs[j];
      if (next === '्') {
        out += base; // virama: no vowel
        i = j;
      } else if (next !== undefined && DV_MATRA[next] !== undefined) {
        out += base + DV_MATRA[next];
        i = j;
      } else {
        out += base + (j >= cs.length ? '' : 'a'); // the inherent vowel, dropped at the end of a word
        i = j - 1;
      }
    } else if (DV_VOWEL[c] !== undefined) out += DV_VOWEL[c];
    else if (c === 'ं') out += DV_LABIAL.has(cs[i + 1]) ? 'm' : 'n'; // anusvara
    else if (c === 'ः') out += 'h'; // visarga
    else if (c >= '०' && c <= '९') out += String(c.charCodeAt(0) - 0x0966);
    // candrabindu, nukta alone, avagraha and anything else: nothing
  }
  return out;
}

// ---- tokens, folds and skeletons -------------------------------------------------------------------

type NameTok = Readonly<{ fold: string; skel: string; deva: boolean }>;

/** Romanisation-tolerant form: vowel length, w/v and a final -y folded ('Modee', 'Mody' → 'modi'). */
function latinFold(t: string): string {
  return t
    .replace(/a{2,}/g, 'a')
    .replace(/e{2,}|i{2,}/g, 'i')
    .replace(/o{2,}|u{2,}/g, 'u')
    .replace(/w/g, 'v')
    .replace(/([^aeiou])y$/, '$1i');
}
/** Consonant skeleton ('Mamta Bannerjee' and 'ममता बनर्जी' both → 'mt' 'bnrj'). */
function skeleton(fold: string): string {
  return fold
    .replace(/c(?!h)/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 'j')
    .replace(/f/g, 'p')
    .replace(/([bcdgjklmnprstv])h/g, '$1')
    .replace(/ng(?![aeiou])/g, 'n')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
}
function tok(word: string): NameTok {
  const deva = DEVA.test(word);
  const latin = deva ? transliterateDevanagari(word) : word;
  const fold = latinFold(latin);
  return { fold, skel: skeleton(fold), deva };
}

type Scanned = Readonly<{ tokens: NameTok[]; words: string[]; unsupported: boolean }>;

/** Split a name into comparable tokens; `unsupported` when it holds letters we cannot check. */
function scanName(name: unknown): Scanned {
  const s = cleanName(name).normalize('NFKD').replace(LATIN_MARKS, '').normalize('NFC').toLowerCase();
  let unsupported = false;
  let mapped = '';
  for (const ch of s) {
    if (/\p{L}/u.test(ch) && !/[a-z]/.test(ch) && !DEVA.test(ch)) {
      if (LATIN_EXTRA[ch] !== undefined) mapped += LATIN_EXTRA[ch];
      else {
        unsupported = true;
        mapped += ' ';
      }
    } else mapped += ch;
  }
  const words: string[] = [];
  for (const raw of mapped.split(/\s+/)) {
    if (!raw) continue;
    // Look-alike digits count as letters only inside a word that has letters.
    const w = /[a-z]/.test(raw) ? raw.replace(/[013457@$!|8]/g, (c) => LEET[c] ?? c) : raw;
    for (const part of w.split(/[^a-z0-9ऀ-ॿ꣠-ꣿ]+/)) {
      if (!part) continue;
      if (/[a-z]/.test(part) && DEVA.test(part)) unsupported = true; // one word, two scripts
      words.push(part);
    }
  }
  return { tokens: words.map(tok), words, unsupported };
}

const HONORIFIC_FOLDS = new Set([...HONORIFICS].map((h) => latinFold(h)));
const TITLE_FOLDS = new Set([...TITLES].map((h) => latinFold(h)));
/** Honorifics that are also given names: dropped only after the first word ('Stalin Anna', not 'Anna Shah'). */
const NAME_TOO = new Set(['anna']);
/** The name without its honorifics ('PM Modi ji' → 'Modi'). */
const stripHonorifics = (toks: readonly NameTok[]) =>
  toks.filter((t, i) => !HONORIFIC_FOLDS.has(t.fold) || (i === 0 && NAME_TOO.has(t.fold)));
/** Runs of single letters joined into one word: 'N a r e n d r a' → 'narendra'. */
function joinLetters(toks: readonly NameTok[]): NameTok[] {
  const out: NameTok[] = [];
  let run: NameTok[] = [];
  const flush = () => {
    if (run.length >= 2) out.push(tok(run.map((t) => t.fold).join('')));
    else out.push(...run);
    run = [];
  };
  for (const t of toks) {
    if (!t.deva && t.fold.length === 1) run.push(t);
    else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out;
}

/**
 * Do two tokens name the same word? Folds must match; when either side is Devanagari (transliteration
 * is rough) a consonant skeleton of three or more ('kjrvl') also counts; and, `loose` — inside a listed
 * full name, where every other word must match too — so does one edit on words of five letters or more
 * ('Mamta Bannerjee').
 */
function same(a: NameTok, b: NameTok, loose = false): boolean {
  if (a.fold === b.fold) return true;
  if (!(loose || a.deva || b.deva)) return false;
  if (a.skel.length >= 3 && a.skel === b.skel) return true;
  return loose && a.fold.length >= 5 && b.fold.length >= 5 && oneEditApart(a.fold, b.fold);
}
/** Levenshtein distance ≤ 1 ('mamta' ~ 'mamata', 'bannerji' ~ 'banerji'). */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * Normalise a person's name for comparison: Unicode NFKC then NFKD, accents stripped, lower case,
 * punctuation to spaces, honorifics (Shri, Smt, Dr, PM, ji…) dropped. Devanagari letters are kept.
 * 'Dr. N. Chandrababu  Naidu' → 'n chandrababu naidu'.
 */
export function normalizePersonName(name: string): string {
  return String(name ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .normalize('NFKD')
    .replace(LATIN_MARKS, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ꣠-ꣿ]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !HONORIFICS.has(t))
    .join(' ');
}

type Listed = Readonly<{ toks: NameTok[]; compact: string; compactSkel: string }>;
type NameIndex = Readonly<{
  /** Every listed name exactly, initials included ('a raja', 'v p singh'). */
  exact: ReadonlySet<string>;
  /** Names of two or more real tokens (initials dropped): every token must appear, in any order. */
  full: Listed[];
  /** One-token names ('Mayawati', 'A. Raja' → 'raja'): the whole name must be that token. */
  single: NameTok[];
  /** Last names of listed people, less the common ones: a lone one does not print ('Modi', 'Kejriwal'). */
  last: NameTok[];
  /** Parties, outlets, institutions, epithets, groups: matched as a run of tokens anywhere. */
  bodies: Listed[];
}>;

function listed(name: string): Listed | null {
  const { tokens } = scanName(name);
  if (!tokens.length) return null;
  return { toks: tokens, compact: tokens.map((t) => t.fold).join(''), compactSkel: tokens.map((t) => t.skel).join('') };
}

function buildIndex(names: Iterable<string>, bodyNames: Iterable<string>): NameIndex {
  const commons = new Set(COMMON_SURNAMES.map((n) => latinFold(n)));
  const full: Listed[] = [];
  const single: NameTok[] = [];
  const last: NameTok[] = [];
  const exact = new Set<string>();
  const seen = new Set<string>();
  const add = (toks: NameTok[]) => {
    const key = toks.map((t) => t.fold).join(' ');
    if (!toks.length || seen.has(key)) return;
    seen.add(key);
    if (toks.length === 1) single.push(toks[0]);
    else full.push({ toks, compact: toks.map((t) => t.fold).join(''), compactSkel: toks.map((t) => t.skel).join('') });
  };
  for (const n of names) {
    const toks = stripHonorifics(scanName(n).tokens);
    if (toks.length) exact.add(toks.map((t) => t.fold).join(' '));
    const core = toks.filter((t) => t.fold.length > 1);
    // 'V. P. Singh' is not every Singh: a one-token core left by initials counts only if uncommon.
    if (core.length === 1 && toks.length > 1 && commons.has(core[0].fold)) continue;
    add(core);
    // 'Atal Bihari Vajpayee' is also typed 'Atal Vajpayee'.
    if (core.length >= 3) add([core[0], core[core.length - 1]]);
    const tail = core[core.length - 1];
    if (core.length >= 2 && tail && !commons.has(tail.fold) && !last.some((l) => l.fold === tail.fold)) last.push(tail);
  }
  const bodies: Listed[] = [];
  for (const n of bodyNames) {
    const l = listed(n);
    if (l) bodies.push(l);
  }
  return { exact, full, single, last, bodies };
}

let bankIndex: NameIndex | null = null;
let publicIndex: NameIndex | null = null;
const bankPeople = () => {
  const names = new Set<string>();
  for (const q of BANK_ITEMS) {
    for (const n of q.people ?? []) names.add(n);
    for (const e of q.enactedBy ?? []) names.add(e.name);
  }
  return names;
};
function indexes(): { bank: NameIndex; public: NameIndex } {
  bankIndex ??= buildIndex(bankPeople(), []);
  publicIndex ??= buildIndex(PUBLIC_FIGURES, [
    ...PUBLIC_NAMES,
    ...GROUP_NAMES,
    ...GOVTS.filter((g) => g !== 'Other'),
  ]);
  return { bank: bankIndex, public: publicIndex };
}

/** Does the scanned name match anything in `ix`? */
function matchesIndex(sc: Scanned, ix: NameIndex): boolean {
  const words = joinLetters(sc.tokens);
  const joined = words.map((t) => t.fold).join('');
  // A word that runs a listed name into more ('NarendraModiFan', 'GodiMediaWala').
  const inside = (compact: string, min: number) =>
    compact.length >= min && words.some((w) => w.fold.length > compact.length && w.fold.includes(compact));
  // Parties, outlets, institutions, epithets and groups: a run of words anywhere in the name. A short
  // acronym (SP, ED) only as the whole name.
  for (const b of ix.bodies) {
    const n = b.toks.length;
    if (n === 1 && b.toks[0].fold.length <= 2) {
      if (words.length === 1 && same(words[0], b.toks[0])) return true;
      continue;
    }
    for (const seq of [sc.tokens, words]) {
      for (let i = 0; i + n <= seq.length; i++) if (b.toks.every((t, k) => same(seq[i + k], t))) return true;
    }
    if (joined === b.compact || inside(b.compact, 6)) return true;
  }
  const named = joinLetters(stripHonorifics(sc.tokens));
  if (!named.length) return false;
  if (ix.exact.has(stripHonorifics(sc.tokens).map((t) => t.fold).join(' '))) return true;
  const core = named.filter((t) => t.fold.length > 1);
  const compact = named.map((t) => t.fold).join('');
  const compactSkel = named.map((t) => t.skel).join('');
  const anyDeva = named.some((t) => t.deva);
  // A full name: every word of a listed person appears, in any order ('Modi Narendra D.'), or the name
  // is that person run together ('NarendraModi', 'N a r e n d r a M o d i').
  for (const p of ix.full) {
    if (core.length && p.toks.every((t) => core.some((c) => same(c, t, true)))) return true;
    if (compact === p.compact || inside(p.compact, 8)) return true;
    if (anyDeva && p.compactSkel.length >= 4 && compactSkel === p.compactSkel) return true;
  }
  // One word: a one-word listed name ('Mayawati', 'Yogi') or a lone listed surname ('Modi', 'Kejriwal').
  if (core.length === 1) {
    const [c] = core;
    if (ix.single.some((t) => same(c, t))) return true;
    if (ix.last.some((t) => same(c, t))) return true;
  }
  // A listed surname or one-word name addressed with an honorific or title beside it: 'PM Modi fan',
  // 'Kejriwal ji ki jai' (a bare 'Rohan Modi' still prints).
  const toks = sc.tokens;
  for (let i = 0; i < toks.length; i++) {
    const beside = (j: number) => j >= 0 && j < toks.length && HONORIFIC_FOLDS.has(toks[j].fold) && !(j === 0 && NAME_TOO.has(toks[j].fold));
    if (!beside(i - 1) && !beside(i + 1)) continue;
    if (HONORIFIC_FOLDS.has(toks[i].fold)) continue;
    if (ix.last.some((t) => same(toks[i], t)) || ix.single.some((t) => same(toks[i], t))) return true;
  }
  return false;
}

/** True when `name` is (normalised, loosely) a person named anywhere in the bank's `people` / `enactedBy`. */
export function isBankPerson(name: string): boolean {
  const sc = scanName(name);
  if (!sc.tokens.length) return false;
  const named = stripHonorifics(sc.tokens);
  const core = named.filter((t) => t.fold.length > 1);
  if (!core.length) return false;
  const ix = indexes().bank;
  if (ix.exact.has(named.map((t) => t.fold).join(' '))) return true;
  if (core.length === 1) return ix.single.some((t) => same(core[0], t)) || ix.last.some((t) => same(core[0], t));
  return ix.full.some((p) => p.toks.length === core.length && p.toks.every((t) => core.some((c) => same(c, t, true))));
}

/**
 * True when `name` is a bank person, contains one's full name ('Rahul Gandhi fan', 'Team Mamata
 * Banerjee'), or is a lone listed surname ('Modi ji'). A lone common surname ('Sharma') does not count.
 */
export function mentionsBankPerson(name: string): boolean {
  return matchesIndex(scanName(name), indexes().bank);
}

/** Why a name may not print: 'empty', 'script' (letters we cannot check), 'public', or null (it prints). */
export type NameBlock = 'empty' | 'script' | 'public' | null;

/**
 * The certificate gate: is `name` empty, in a script we cannot check, or (loosely) a public figure,
 * party, outlet, institution or community — anyone in the bank or in ./public-names.ts?
 */
export function nameBlock(name: unknown): NameBlock {
  const sc = scanName(name);
  if (!sc.tokens.length) return sc.unsupported ? 'script' : 'empty';
  if (sc.unsupported) return 'script';
  const core = stripHonorifics(sc.tokens).filter((t) => t.fold.length > 1);
  // Nothing but titles and honorifics: 'PM', 'CM sahab', 'Didi'.
  if (!core.length && sc.tokens.some((t) => TITLE_FOLDS.has(t.fold))) return 'public';
  const { bank, public: pub } = indexes();
  if (matchesIndex(sc, bank) || matchesIndex(sc, pub)) return 'public';
  return null;
}

/** Longest name printed on a certificate or a share (bible §8.4). */
export const NAME_MAX = 20;

/** The first `n` user-perceived characters (a matra never parts from its letter). */
function clip(text: string, n: number): string {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  const parts = Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (x) => x.segment) : Array.from(text);
  return parts.slice(0, n).join('');
}

/**
 * The name a certificate or share card may print: the player's name (NFKC, invisible and bidi
 * characters removed) trimmed to NAME_MAX, or 'Anonymous Janta' when it is empty, in a script we
 * cannot check, or is — or looks like — a public figure, party, outlet, institution or community
 * (labels never apply to real people, bible §8.5). Both the whole name and the trimmed one are checked.
 */
export function certificateName(name: string | null | undefined): string {
  const whole = cleanName(name);
  const clean = clip(whole, NAME_MAX).trim();
  if (!clean || nameBlock(whole) !== null || nameBlock(clean) !== null) return ANONYMOUS;
  return clean;
}
