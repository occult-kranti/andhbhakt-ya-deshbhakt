/**
 * screens/me/lib.ts — read-only helpers for the Profile, the certificate and (shared inside the Me
 * lane) the Receipts Vault and Settings: the player's own name, promotion dates, the Stamp Register,
 * duel performance, file tallies and a media-query hook. No JSX; nothing here writes the profile.
 */
import { useSyncExternalStore } from 'react';
import { STORAGE } from '@/lib/storage-names.mjs';
import { ACHIEVEMENTS, levelForXp, rankForPoints, XP } from '@/lib/progression.mjs';
import { expeditionStatus } from '@/lib/expeditions.mjs';
import { ROUTES, UNREACHABLE_ACHIEVEMENTS, type Route } from '../../../edition';
import { ACHIEVEMENT_WORDS, babuRank, LADDER_DISPLAY } from '../../data';

// ---- the player's name (optional; never pre-filled with anything but their own) ---------------------

/** Longest name the engine seats (duel lobbies share the key); certificates print the first 20. */
export const NAME_INPUT_MAX = 24;

const nameListeners = new Set<() => void>();
function readStoredName(): string {
  try {
    return (localStorage.getItem(STORAGE.name) ?? '').trim().slice(0, NAME_INPUT_MAX);
  } catch {
    return '';
  }
}
/** Keep the name the player typed on this device (blank clears it). */
export function savePlayerName(name: string) {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, NAME_INPUT_MAX);
  try {
    if (clean) localStorage.setItem(STORAGE.name, clean);
    else localStorage.removeItem(STORAGE.name);
  } catch {
    /* storage blocked: the name lasts for this visit */
  }
  for (const fn of Array.from(nameListeners)) fn();
}
function subscribeName(fn: () => void) {
  nameListeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE.name) fn();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    nameListeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}
/** The saved display name ('' when none), live across tabs and screens. */
export function usePlayerName(): string {
  return useSyncExternalStore(subscribeName, readStoredName, () => '');
}

// ---- layout ---------------------------------------------------------------------------------------------

/** True while `query` matches (e.g. the rail layout at min-width 900px). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      if (typeof matchMedia !== 'function') return () => {};
      const mql = matchMedia(query);
      mql.addEventListener('change', fn);
      return () => mql.removeEventListener('change', fn);
    },
    () => (typeof matchMedia === 'function' ? matchMedia(query).matches : false),
    () => false,
  );
}

// ---- progression shapes (the engine's records, typed loosely) -----------------------------------------

export type LogEntry = { id: string; at: number; kind: string; xp: number; label: string; meta?: Record<string, unknown> };
export type ProgressionLike = {
  xp: number;
  streak: { current: number; best: number; lastDay: string | null; shields: number; frozenDays?: number };
  achievements: Record<string, number>;
  rank: { points: number; tier: string; best: string; floor: number };
  counters: { matches: number; wins: number; stamps: number; facts: number; bestCombo: number; byMode: Record<string, { played: number; wins: number }> } & Record<string, unknown>;
  log: LogEntry[];
};

/**
 * When each band was reached, where the record still says so: a 'level' log line that crossed into the
 * band (the log keeps the last 40 XP events), or the engine's own Level 10 / 25 / 40 register entries
 * (bands 2, 5, 8). Band 0 has no date (everyone starts there). Unknown dates are simply absent.
 */
export function promotionDates(prog: ProgressionLike | null | undefined): Map<number, number> {
  const out = new Map<number, number>();
  if (!prog) return out;
  for (const e of prog.log ?? []) {
    if (e.kind !== 'level') continue;
    const from = Number(e.meta?.from);
    const to = Number(e.meta?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    const bFrom = Math.min(8, Math.floor(from / 5));
    const bTo = Math.min(8, Math.floor(to / 5));
    for (let b = bFrom + 1; b <= bTo; b++) {
      const prev = out.get(b);
      if (prev === undefined || e.at < prev) out.set(b, e.at);
    }
  }
  const byAchievement: Array<[string, number]> = [
    ['level-10', 2],
    ['level-25', 5],
    ['level-40', 8],
  ];
  for (const [id, band] of byAchievement) {
    const at = prog.achievements?.[id];
    if (typeof at === 'number' && Number.isFinite(at) && !out.has(band)) out.set(band, at);
  }
  return out;
}

/** '25 Sep 2026' (Latin digits in both locales). */
export function shortDate(at: number): string {
  const d = new Date(at);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
}

/** 'Levels 20–24' / 'Level 40+' for a rung. */
export function rungLevels(band: number): string {
  const r = LADDER_DISPLAY[band];
  if (!r) return '';
  return r.to === null ? `Level ${r.from}+` : `Levels ${r.from}–${r.to}`;
}
/** Just the range, '20–24' / '40+' (digits: mono-safe in either locale; the word goes beside it). */
export function rungRange(band: number): string {
  const r = LADDER_DISPLAY[band];
  if (!r) return '';
  return r.to === null ? `${r.from}+` : `${r.from}–${r.to}`;
}

// ---- the Stamp Register (achievements, listed silently) ------------------------------------------------

type Achievement = { id: string; name: string; description: string; tier: 'bronze' | 'silver' | 'gold'; hidden: boolean; xp: number };

/** The edition's wording for engine achievements (data.ts ACHIEVEMENT_WORDS — shared with Activity). */
const EDITION_WORDS = ACHIEVEMENT_WORDS;

/**
 * Engine achievements this edition can never award: sports/science tallies. (vault-25 is reachable: a
 * receipt's "Keep a copy" in the Vault is the engine's save.)
 */
const HIDDEN_HERE = new Set<string>(UNREACHABLE_ACHIEVEMENTS);

export type RegisterEntry = Readonly<{
  id: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  xp: number;
  at: number | null;
  hidden: boolean;
}>;

/** The Stamp Register: every achievement this edition can award, earned first (newest first). */
export function stampRegister(prog: ProgressionLike | null | undefined): { entries: RegisterEntry[]; hiddenLeft: number } {
  const earned = prog?.achievements ?? {};
  const list = (ACHIEVEMENTS as readonly Achievement[]).filter((a) => !HIDDEN_HERE.has(a.id));
  const entries: RegisterEntry[] = [];
  let hiddenLeft = 0;
  for (const a of list) {
    const at = typeof earned[a.id] === 'number' ? earned[a.id] : null;
    if (a.hidden && at === null) {
      hiddenLeft += 1;
      continue;
    }
    const words = EDITION_WORDS[a.id] ?? {};
    entries.push(Object.freeze({ id: a.id, name: words.name ?? a.name, description: words.description ?? a.description, tier: a.tier, xp: a.xp, at, hidden: a.hidden }));
  }
  entries.sort((a, b) => (b.at ?? -1) - (a.at ?? -1));
  return { entries, hiddenLeft };
}

// ---- recorded duel performance ----------------------------------------------------------------------

/** Settled duel counters only. Untimed files, daily cards and missing legacy times are not inferred. */
export function duelPerformance(prog: ProgressionLike | null | undefined) {
  const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const rounds = count(prog?.counters?.rounds);
  const correct = Math.min(rounds, count(prog?.counters?.correct));
  const time = prog?.counters?.fastestCorrectMs;
  const fastestCorrectMs = correct > 0 && typeof time === 'number' && Number.isFinite(time) && time >= 0 ? time : null;
  return { rounds, correct, accuracy: rounds ? Math.round(correct / rounds * 100) : null, fastestCorrectMs };
}

// ---- files cleared ------------------------------------------------------------------------------------

type Journeys = Record<string, unknown>;

/** How many files of a kind exist and how many the player has cleared at least once. */
export function filesCleared(journeys: Journeys | null | undefined, kinds: ReadonlyArray<Route['kind']>) {
  const routes = ROUTES.filter((r) => kinds.includes(r.kind));
  let cleared = 0;
  for (const r of routes) if (expeditionStatus((journeys ?? {})[r.key]) === 'complete') cleared += 1;
  return { cleared, total: routes.length };
}

// ---- Babu rank (Arena Rank renamed, on this device) ---------------------------------------------------

export function babuRankView(prog: ProgressionLike | null | undefined) {
  const points = prog?.rank?.points ?? 0;
  const r = rankForPoints(points) as { tier: string; into: number; toNext: number; progress: number };
  const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const next = tiers[tiers.indexOf(r.tier) + 1] ?? null;
  return {
    label: babuRank(r.tier),
    best: babuRank(prog?.rank?.best ?? r.tier),
    points,
    into: r.into,
    toNext: r.toNext,
    next: next ? babuRank(next) : null,
    progress: r.progress,
  };
}

/** Level + band of an XP total (the engine's maths). */
export const levelOf = (xp: number) => levelForXp(xp) as { level: number; band: number; into: number; toNext: number; progress: number };

/** The XP numbers the Rules page quotes, straight from the engine's table. */
export const XP_TABLE = XP as unknown as Readonly<Record<string, number | Readonly<Record<string, number>>>>;
