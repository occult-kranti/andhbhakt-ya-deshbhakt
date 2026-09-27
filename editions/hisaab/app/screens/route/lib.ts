/**
 * screens/route/lib.ts — read helpers for the untimed card players (route lane): the route player and
 * finish (#/route/:id), Aaj Ka Hisaab (#/aaj) and the one-card taster (#/q/:id).
 *
 * Nothing here writes. Every number a card or a finish prints comes from the player's profile: the
 * run (`profile.journeys[route.key]`, lib/expeditions.mjs), the journal's rounds (the `practice` and
 * `journey:` round ids) and the progression log (the XP each action actually paid). Pure apart from
 * the two small hooks at the end.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { routesOfKind, type Card, type Route } from '../../../edition';
import {
  CARTOGRAM,
  CARTOGRAM_CENTRE,
  formatNumber,
  SECTOR_NAMES_HI,
  stateName,
  stateNameHi,
  xpLogWords,
  type BankItem,
} from '../../data';
import { href } from '../../router';
import { shareOutcomeWords, type ShareOutcome } from '../../share';

// ---- profile shapes (usePlayer's profile is untyped; these are the fields this lane reads) ------------

export type RunAnswer = { choice: number; elapsedMs?: number | null };
export type Run = { id: string; cards: Card[]; startedAt: number; cursor: number; answers: RunAnswer[] };
export type Tally = Record<'steady' | 'bold' | 'called', { n: number; correct: number }>;
export type RunResult = { runId: string; at: number; score: number; correct: number; bold: number; stakes?: Tally };
export type JourneyRecord = {
  run: Run | null;
  first: RunResult | null;
  best: RunResult | null;
  last: RunResult | null;
  bestScore: number | null;
  completions: number;
  folded: boolean;
  foldedDay: string | null;
};
export type Journeys = Readonly<Record<string, JourneyRecord | undefined>>;

export type JournalRound = {
  id: string;
  at: number;
  factId: string;
  correct?: boolean;
  elapsedMs?: number | null;
  chose?: string | null;
};
export type Journal = { rounds?: JournalRound[]; facts?: Record<string, { firstAt?: number | null } | undefined> } | null | undefined;
export type LogEntry = { id?: string; at: number; kind: string; xp: number; label: string; meta?: Record<string, unknown> };
export type Streak = { current: number; best: number; lastDay: string | null; shields: number };
export type Progression = { xp?: number; log?: LogEntry[]; streak?: Streak } | null | undefined;

/** Six cards per route: the engine hard-codes it (ENGINE §14). */
export const RUN_CARDS = 6;
/** The run score band (lib/expeditions.mjs MIN_SCORE / MAX_SCORE). */
export const MAX_RUN_SCORE = 6;

// ---- round ids --------------------------------------------------------------------------------------

/** The journal round id an expedition answer is filed under (lib/passport.mjs applyAction). */
export const journeyRoundId = (runId: string, index: number) => `journey:${runId}:${index}`;
/** The taster's practice round id: one per bank item, so a replayed link never pays twice. */
export const tasterRoundId = (id: string) => `practice:taster-${id}:0`;

export function roundsById(journal: Journal): Map<string, JournalRound> {
  const map = new Map<string, JournalRound>();
  for (const r of journal?.rounds ?? []) if (r && typeof r.id === 'string' && !map.has(r.id)) map.set(r.id, r);
  return map;
}

/** Which option a journaled round picked, as an index into `options` (the journal stores the text). */
export function choiceOf(round: JournalRound | undefined, options: readonly string[]): number | null {
  if (!round || typeof round.chose !== 'string') return null;
  const i = options.indexOf(round.chose);
  return i >= 0 ? i : null;
}

// ---- points, calibration ---------------------------------------------------------------------------

/** Signed score for receipt displays. */
export const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(Math.abs(n))}` : '0');

// ---- XP, read back from the progression log ------------------------------------------------------

/** The edition's words for a progression log line (one mapping for every screen: data.xpLogWords). */
const xpWords = (e: LogEntry) => xpLogWords(e);

export type XpLine = { xp: number; note: string; answerXp?: number };

/**
 * What one action paid: every progression log line written at that action's timestamp (the answer,
 * a new receipt, a quest it completed). Null when the log no longer holds it (it keeps 40 lines).
 */
export function xpAt(log: readonly LogEntry[] | undefined, at: number | null | undefined): XpLine | null {
  if (!log || typeof at !== 'number') return null;
  const lines = log.filter((e) => e && e.at === at && Number.isFinite(e.xp) && e.xp >= 0);
  if (!lines.length) return null;
  return {
    xp: lines.reduce((s, e) => s + e.xp, 0),
    answerXp: lines.filter(e => ['discovery', 'expedition-answer'].includes(e.kind)).reduce((sum, e) => sum + e.xp, 0),
    note: lines
      .slice()
      .reverse()
      .map((e) => `${xpWords(e)} +${formatNumber(e.xp)}`)
      .join(' · '),
  };
}

/** The XP a journaled round's action paid (journal round → its `at` → the log). */
export function xpForRound(rounds: Map<string, JournalRound>, log: readonly LogEntry[] | undefined, roundId: string): XpLine | null {
  return xpAt(log, rounds.get(roundId)?.at);
}

// ---- receipts ---------------------------------------------------------------------------------------

/**
 * A receipt's number: its place among every distinct fact the player has answered, in the order they
 * were first met (the tijori's coins). Null before the fact is on file.
 */
export function receiptOrdinal(journal: Journal, factId: string): number | null {
  const first = new Map<string, number>();
  const note = (id: string | null | undefined, at: number | null | undefined) => {
    if (!id) return;
    const t = typeof at === 'number' && Number.isFinite(at) ? at : Number.MAX_SAFE_INTEGER;
    const prev = first.get(id);
    if (prev === undefined || t < prev) first.set(id, t);
  };
  for (const [id, f] of Object.entries(journal?.facts ?? {})) note(id, f?.firstAt ?? null);
  for (const r of journal?.rounds ?? []) note(r?.factId, r?.at);
  const mine = first.get(factId);
  if (mine === undefined) return null;
  let n = 0;
  for (const [id, t] of first) if (t < mine || (t === mine && id <= factId)) n += 1;
  return n;
}

/** How many distinct receipts the player holds (the same count as the tijori). */
export function receiptCount(journal: Journal): number {
  const ids = new Set<string>(Object.keys(journal?.facts ?? {}));
  for (const r of journal?.rounds ?? []) if (r?.factId) ids.add(r.factId);
  return ids.size;
}

/** The other side's answer, when a bank item carries it as its own field (none do yet; bank lanes may add it). */
export function otherSideOf(item: BankItem | null | undefined): string | null {
  const v = (item as { otherSide?: unknown } | null | undefined)?.otherSide;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// ---- the card kicker (spoiler-safe) -------------------------------------------------------------

/**
 * Kicker parts for a card: sector · state · year (bible §11.7). A part is dropped when an option
 * contains it, so the kicker never hints at the answer ("In which year…" never shows its year; "Which
 * state…" never shows its state). The subtopic is never printed before the answer: it can hold it.
 */
export function cardKicker(card: Pick<Card, 'topic' | 'options'>, item: BankItem | null, isHi = false): string[] {
  const opts = card.options.map((o) => o.toLowerCase());
  const safe = (text: string) => !!text && !opts.some((o) => o.includes(text.toLowerCase()));
  const parts: string[] = [];
  if (safe(card.topic)) parts.push(isHi ? (SECTOR_NAMES_HI[card.topic] ?? card.topic) : card.topic);
  if (item?.state) {
    const en = stateName(item.state);
    if (safe(en) && safe(stateName(item.state, { long: true }))) parts.push(isHi ? stateNameHi(item.state) : en);
  }
  if (item && Number.isInteger(item.year) && safe(String(item.year))) parts.push(String(item.year));
  return parts;
}

// ---- file numbers, names, hubs ---------------------------------------------------------------------

/** The file's typed tab ('F.No. S/UP'); one source in data.ts so the lanes never drift. */
export { fileNo } from '../../data';

/** The Devanagari twin of a file's title, where the edition has one. */
export function routeTitleHi(route: Route): string | undefined {
  if (route.kind === 'state' && route.state) return stateNameHi(route.state);
  if (route.kind === 'sector' && route.sector) return SECTOR_NAMES_HI[route.sector];
  if (route.kind === 'media') return 'किसका मीडिया?';
  if (route.kind === 'forward') return 'फ़ॉरवर्ड अदालत';
  return undefined;
}

/** The hub a file belongs to (× on a card, "Choose another" on a finish). */
export function hubHref(route: Route): string {
  switch (route.kind) {
    case 'state':
      return href.files('states', route.state ? { s: route.state } : undefined);
    case 'sector':
      return href.files('sectors');
    case 'media':
      return href.files('media');
    case 'forward':
      return href.files('forwards');
    case 'year':
      return href.money('years');
    default:
      return href.money(route.kind);
  }
}

/** Kinds whose FIRST clear opens the `file` ceremony (bible §9: state, sector, Kiska Media?, Forward Court). */
export const CEREMONY_KINDS: ReadonlySet<Route['kind']> = new Set(['state', 'sector', 'media', 'forward']);

const cleared = (r: Route, journeys: Journeys) => !!journeys[r.key]?.first;

/** Grid neighbours of a state in the records-room cartogram (8 around it; the Centre drawer counts). */
function neighbours(code: string): string[] {
  const at = new Map<string, [number, number]>();
  CARTOGRAM.forEach((row, r) => row.forEach((c, col) => c && at.set(c, [r, col])));
  for (let k = 0; k < CARTOGRAM_CENTRE.span; k += 1) at.set(`IN@${k}`, [CARTOGRAM_CENTRE.row, CARTOGRAM_CENTRE.col + k]);
  const cells = code === 'IN' ? [...at.entries()].filter(([c]) => c.startsWith('IN@')).map(([, p]) => p) : at.has(code) ? [at.get(code)!] : [];
  const out = new Set<string>();
  for (const [r0, c0] of cells)
    for (const [c, [r, col]] of at) {
      const name = c.startsWith('IN@') ? 'IN' : c;
      if (name !== code && Math.abs(r - r0) <= 1 && Math.abs(col - c0) <= 1) out.add(name);
    }
  return [...out];
}

/**
 * The finish's suggestion (bible §11.13): a neighbouring state tile, the next sector, the other
 * records-room file, the next money-trail or year file — the first one not yet cleared. Null when
 * every file of that kind is cleared (the finish then offers "Choose another" only).
 */
export function nextFile(route: Route, journeys: Journeys): Route | null {
  const same = routesOfKind(route.kind).filter((r) => r.id !== route.id);
  const open = (list: readonly Route[]) => list.find((r) => !cleared(r, journeys)) ?? null;
  if (route.kind === 'state' && route.state) {
    const near = neighbours(route.state)
      .map((code) => same.find((r) => r.state === code))
      .filter((r): r is Route => !!r);
    return open(near) ?? open(same);
  }
  if (route.kind === 'media' || route.kind === 'forward') {
    const other = routesOfKind(route.kind === 'media' ? 'forward' : 'media');
    return open(other) ?? open(routesOfKind('sector'));
  }
  // Sectors, money trail, years: the next one in catalogue order, wrapping round.
  const all = routesOfKind(route.kind);
  const i = all.findIndex((r) => r.id === route.id);
  const ordered = [...all.slice(i + 1), ...all.slice(0, Math.max(0, i))];
  return open(ordered);
}

// ---- small hooks ------------------------------------------------------------------------------------

export type ShareState = { status: 'idle' | 'busy' | 'done' | 'failed'; method?: ShareOutcome['method'] };

/**
 * Inline share outcome for a button ("Copied ✓" on the button itself, never a toast — bible §9).
 * The word reverts after a few seconds.
 */
export function useShareState() {
  const [state, setState] = useState<ShareState>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const run = useCallback(async (share: () => Promise<ShareOutcome>) => {
    setState({ status: 'busy' });
    const out = await share();
    if (timer.current) clearTimeout(timer.current);
    if (out.reason === 'cancelled') {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: out.ok ? 'done' : 'failed', method: out.method });
    timer.current = setTimeout(() => setState({ status: 'idle' }), 4000);
  }, []);
  return { state, run };
}

/** The button words for a share state. */
export function shareWords(state: ShareState, idle: string, t: (en: string, hi?: string) => string): string {
  // One set of words for every share outcome (share/shareOutcomeWords): a PNG card saved on a browser
  // without file sharing reads "Image saved · text copied ✓", not "Shared ✓".
  if (state.status === 'done') return shareOutcomeWords({ ok: true, method: state.method ?? 'share' }, t) ?? idle;
  if (state.status === 'failed') return t('Could not share. Try again', 'भेज नहीं पाए। फिर कोशिश करो');
  return idle;
}

/** 'New file at 00:00 IST' — static, never a countdown (bible §8.5 N2). Honest outside India too. */
export function newFileLine(t: (en: string, hi?: string) => string): string {
  const ist = typeof Date === 'function' && -new Date().getTimezoneOffset() === 330;
  return ist ? t('New file at 00:00 IST.', 'नई फ़ाइल रात 00:00 बजे (IST)।') : t('New file at midnight, your time.', 'नई फ़ाइल आपकी आधी रात को।');
}
