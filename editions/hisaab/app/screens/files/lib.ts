/**
 * screens/files/lib.ts — read helpers shared by the Files and money-trail screens (files lane).
 *
 * Nothing here writes. A route's state on the player's device comes from
 * `player.profile.journeys[route.key]` (lib/expeditions.mjs readExpeditions); which receipts the player
 * holds comes from the journal's per-fact stores. Both are read through the app's one player
 * (shell/player.tsx) — never a second usePlayer().
 */
import { useMemo, useSyncExternalStore } from 'react';
import { expeditionStatus } from '@/lib/expeditions.mjs';
import type { Route } from '../../../edition';
import { BANK_ITEMS, itemById, sourceHost, stateName, stateNameHi, type BankItem } from '../../data';
import { useAppPlayer } from '../../shell/player';

// ---- the player's files ---------------------------------------------------------------------------

type RunResult = { runId: string; at: number; score: number; correct: number };
type JourneyRecord = {
  run: { id: string; cursor: number; startedAt: number; answers: readonly unknown[] } | null;
  first: RunResult | null;
  best: RunResult | null;
  last: RunResult | null;
  bestScore: number | null;
  completions: number;
  folded: boolean;
};
export type Journeys = Readonly<Record<string, JourneyRecord | undefined>>;

/** Where one file stands on this device. */
export type FileStatus = Readonly<{
  /** sealed: never started (or the last run was folded); progress: a run is open; cleared: finished once. */
  state: 'sealed' | 'progress' | 'cleared';
  /** Answers placed in the open run (0–6). */
  done: number;
  /** A run is open (a first run, or a replay of a cleared file). */
  running: boolean;
  best: { correct: number; score: number } | null;
  completions: number;
  /** Last touch (run start or last finish), for "last opened". 0 when never opened. */
  at: number;
}>;

export const CARDS = 6;
const SEALED: FileStatus = Object.freeze({ state: 'sealed', done: 0, running: false, best: null, completions: 0, at: 0 });

export function fileStatus(route: Route | null | undefined, journeys: Journeys): FileStatus {
  if (!route) return SEALED;
  const record = journeys[route.key];
  if (!record) return SEALED;
  const status = expeditionStatus(record) as 'new' | 'continue' | 'complete';
  const running = status === 'continue' && !!record.run;
  const done = running && record.run ? Math.min(CARDS, record.run.answers.length) : 0;
  const best = record.best ?? record.first;
  const at = Math.max(record.run?.startedAt ?? 0, record.last?.at ?? 0, record.first?.at ?? 0);
  return Object.freeze({
    state: record.first ? 'cleared' : running ? 'progress' : 'sealed',
    done,
    running,
    best: best ? { correct: best.correct, score: Math.max(best.score, record.bestScore ?? best.score) } : null,
    completions: record.completions ?? 0,
    at,
  });
}

/** The app player's journeys and journal, typed for the file screens. */
export function usePlayerFiles() {
  const player = useAppPlayer();
  const profile = player.profile as { journeys?: Journeys; journal?: { facts?: object; cards?: object } } | null;
  const journeys: Journeys = profile?.journeys ?? {};
  const journal = profile?.journal;
  const held = useMemo(() => {
    const ids = new Set<string>();
    for (const store of [journal?.facts, journal?.cards]) if (store) for (const id of Object.keys(store)) ids.add(id);
    return ids;
  }, [journal?.facts, journal?.cards]);
  return { journeys, held, loaded: !!player.loaded };
}

/** The file the player touched last among `routes`, or null. */
export function lastOpened(routes: readonly Route[], journeys: Journeys): Route | null {
  let pick: Route | null = null;
  let at = 0;
  for (const r of routes) {
    const s = fileStatus(r, journeys);
    if (s.at > at) {
      at = s.at;
      pick = r;
    }
  }
  return pick;
}

/** The first file that is not cleared (an open run first), else the first file. */
export function nextUnfinished(routes: readonly Route[], journeys: Journeys): Route | null {
  const statuses = routes.map((r) => [r, fileStatus(r, journeys)] as const);
  return (
    statuses.find(([, s]) => s.state === 'progress')?.[0] ??
    statuses.find(([, s]) => s.state === 'sealed')?.[0] ??
    routes[0] ??
    null
  );
}

// ---- copy ----------------------------------------------------------------------------------------------

/** The file's typed tab ('F.No. S/UP'); one source in data.ts so the lanes never drift. */
export { fileNo } from '../../data';

/** 'Best 5/6 · 18 pts' / 'Best 1/6 · 1 pt' (Latin digits; a score runs −18 to 24, so ±1 is singular). */
export const bestText = (best: FileStatus['best']) =>
  best ? `Best ${best.correct}/${CARDS} · ${best.score} ${Math.abs(best.score) === 1 ? 'pt' : 'pts'}` : '';

/** The primary-button words for a file, by where the player stands. */
export function openWords(status: FileStatus, t: (en: string, hi?: string) => string): string {
  if (status.running) return t(`Resume practice · ${status.done} of ${CARDS}`, `अभ्यास जारी रखो · ${status.done}/${CARDS}`);
  if (status.state === 'cleared') return t('Practice again', 'फिर अभ्यास करो');
  return t('Practice this file', 'इस फ़ाइल का अभ्यास');
}

/** One status line in words (never colour alone). */
export function statusWords(status: FileStatus, t: (en: string, hi?: string) => string): string {
  if (status.state === 'cleared')
    return status.running
      ? t(`Cleared · replay open, ${status.done} of ${CARDS} answered`, `क्लियर · दोबारा: ${status.done}/${CARDS}`)
      : t('Cleared', 'क्लियर');
  if (status.state === 'progress') return t(`${status.done} of ${CARDS} answered`, `${status.done}/${CARDS} जवाब`);
  return t('Sealed. Tape cut on first card.', 'सील। पहले कार्ड पर फ़ीता कटेगा।');
}

/**
 * The honest card line for a state file (bible §11.3, ENGINE §7): "4 receipts from Assam, 2 from the
 * Centre." when topped up, else "6 cards · 8 on file".
 */
export function stateCardsLine(route: Route, t: (en: string, hi?: string) => string = (en) => en): string {
  const name = stateName(route.state ?? '');
  if (route.padded.length)
    return t(
      `${route.ownCount} receipts from ${name}, ${route.padded.length} from the Centre.`,
      `${route.ownCount} रसीदें ${stateNameHi(route.state ?? '')} से, ${route.padded.length} केंद्र से।`,
    );
  return t(`${CARDS} cards per practice`, `हर अभ्यास में ${CARDS} कार्ड`);
}

// ---- bank slices -------------------------------------------------------------------------------------

/** Items of a route, in card order (missing ids dropped). */
export const routeItems = (route: Route): BankItem[] => route.ids.map((id) => itemById(id)).filter((q): q is BankItem => !!q);

/** Every registered item carrying a money-trail tag. */
export const taggedItems = (tag: string): BankItem[] => BANK_ITEMS.filter((q) => q.tags?.includes(tag as never));

/** The publisher half of a sourceLabel: 'Alt News — title (date)' → 'Alt News'. */
export function publisher(label: string): string {
  const cut = label.split(/\s[—–-]\s/)[0]?.trim() ?? '';
  return cut.length > 0 && cut.length <= 48 ? cut : '';
}

/** Distinct values, sorted with the locale collator. */
export function distinctSorted(values: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return [...set].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

// ---- spoiler-safe names for sealed entries -------------------------------------------------------
//
// A hub may name a card before the player has answered it, but only with words its question already
// shows. A bank `subtopic` can hold the answer ("MediaOne ban" for "which channel's ban was quashed?",
// "Fake 'BBC survey'" for "what did fact-checkers find?"), so it is never printed raw on a sealed entry.

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'for', 'on', 'by', 'with', 'from']);
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9₹]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w));

/**
 * The parts of an item's subtopic that its question already names, joined with ' / '
 * ('NDTV (VCPL loan)' → 'NDTV / VCPL loan' when the stem mentions both), or null when no part is safe.
 */
export function sealedName(item: BankItem): string | null {
  const stem = new Set(words(item.question));
  const parts = item.subtopic
    .split(/\s*(?:[/·(),:]|\s[—–-]\s|–)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  const safe = parts.filter((p) => {
    const ws = words(p);
    return ws.length > 0 && ws.every((w) => stem.has(w));
  });
  return safe.length ? safe.join(' / ') : null;
}

/**
 * True when `text` shares a word with the item's correct option that its question does not already
 * show — i.e. printing `text` next to a sealed card would hint at the answer.
 */
export function leaksAnswer(text: string, item: BankItem): boolean {
  const stem = new Set(words(item.question));
  const answer = words(item.options[item.correctIndex] ?? '').filter((w) => !stem.has(w));
  if (!answer.length) return false;
  const shown = new Set(words(text));
  return answer.some((w) => shown.has(w));
}

const QUESTION_TAIL = /(?:^|[.!?'’"”)]\s+)((?:What|Which|How|Who|Whom|Where|When|Why|Per|According|Is|Was|Did|Does)\b[^]*)$/;

/**
 * The claim a Forward Court card puts on trial: its stem up to the question sentence ("Viral forward,
 * Nov 2016: 'The new ₹2,000 note carries a GPS nano-chip…'"). It is question text, so it never holds
 * the ruling. Null when the stem has no separate claim.
 */
export function claimOf(item: BankItem): string | null {
  const s = item.question.trim();
  const m = QUESTION_TAIL.exec(s);
  if (!m || m.index === 0) return null;
  const cut = s.slice(0, m.index + (m[0].length - m[1].length)).trim();
  return cut.length >= 24 ? cut : null;
}

/** The publisher half of a sourceLabel ('Alt News — Fake: …' → 'Alt News'), else the host. */
export const sourceName = (item: BankItem) => publisher(item.sourceLabel) || sourceHost(item.sourceUrl);

// ---- Kiska Media? — who owns what -----------------------------------------------------------------

/**
 * Items for the "who owns what" register: Media & Speech items whose status line files them as an
 * ownership or political-link fact (the lane's own wording: "Ownership fact from exchange filings; no
 * allegation…"). Arrests, bans, press-freedom indices and blackouts are not ownership facts.
 */
export function ownershipItems(): BankItem[] {
  return BANK_ITEMS.filter(
    (q) => q.topic === 'Media & Speech' && q.kind === 'media' && /\b(ownership|political-link)\b/i.test(q.status ?? ''),
  );
}

/** Every Forward Court card (kind 'forward'), in bank order. */
export const forwardItems = (): BankItem[] => BANK_ITEMS.filter((q) => q.kind === 'forward');

/** 'KL · 2023' — where and when, mono (Latin only). */
export const placeYear = (item: BankItem) => `${item.state} · ${item.year}`;

// ---- layout ------------------------------------------------------------------------------------------

const noopSubscribe = () => () => {};
/** A CSS media query as React state (SSR-safe; follows resizes). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    typeof window === 'undefined'
      ? noopSubscribe
      : (fn) => {
          const mq = window.matchMedia(query);
          mq.addEventListener('change', fn);
          return () => mq.removeEventListener('change', fn);
        },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  );
}

/** Scroll an element into view only if it is off screen (smooth unless reduced motion). */
export function revealIfHidden(el: Element | null) {
  if (!el || typeof window === 'undefined') return;
  const rect = el.getBoundingClientRect();
  const viewH = window.innerHeight || document.documentElement.clientHeight;
  if (rect.top >= 56 && rect.top < viewH - 80) return;
  const reduced =
    document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
