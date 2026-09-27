/**
 * screens/room/lib.ts — the duel lane's pure helpers: the room projection's shape (ENGINE §6.4), the
 * words for verdicts and margins, and the XP / receipt numbers read back from the profile.
 *
 * Honesty (N1): every margin line comes from `result.reason` and the receipts' `elapsedMs` — nothing
 * here invents a near-miss. A line is returned only when it is true, otherwise null.
 */
import { comboMultiplier, DIFFICULTY_MULTIPLIER, wildRound, XP } from '@/lib/progression.mjs';
import { formatNumber, seatName, xpLogWords } from '../../data';

// ---- the room projection (ENGINE §6.4) -----------------------------------------------------------------

export type Seat = 0 | 1;
export type RoomPlayer = { name: string; ready: boolean; kind: 'human' | 'bot' } | null;
export type SeatReceipt = { choice: number; correct: boolean; elapsedMs: number; simulated?: boolean } | null;
export type RoundResult = { winner: Seat | null; reason: string; tieMs?: number };
export type RoomQuestion = {
  id?: string;
  factId?: string;
  topic: string;
  subtopic?: string;
  difficulty?: string;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  sourceUrl?: string;
  sourceLabel?: string;
};
export type LiveRound = {
  id: string;
  scheduledAt: number;
  issuedAt: number | null;
  answerLocked: boolean[];
  question: RoomQuestion | null;
  result: RoundResult | null;
  receipts?: SeatReceipt[];
};
export type DoneRound = {
  id: string;
  index: number;
  question: RoomQuestion;
  result: RoundResult;
  receipts: SeatReceipt[];
};
export type RoomConfig = {
  mode: DuelMode;
  duration: number;
  topic?: string;
  opponent?: string;
  difficulty?: string;
};
export type Room = {
  id: string;
  revision: number;
  seat: Seat;
  phase: 'waiting' | 'scheduled' | 'playing' | 'between' | 'complete' | 'cancelled';
  roundIndex: number;
  config: RoomConfig;
  players: RoomPlayer[];
  scores: [number, number];
  settled: boolean;
  winner: Seat | null;
  reason: string | null;
  completedRounds: DoneRound[];
  round: LiveRound | null;
};
export type DuelMode = 'quick' | 'trilogy' | 'gauntlet';

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/** The settled rounds in order, including the live round once its result is in. */
export function settledRounds(room: Room | null | undefined): DoneRound[] {
  if (!room) return [];
  const done = [...(room.completedRounds ?? [])];
  const rd = room.round;
  if (rd?.result && rd.question && !done.some((r) => r.id === rd.id))
    done.push({
      id: rd.id,
      index: room.roundIndex,
      question: rd.question,
      result: rd.result,
      receipts: rd.receipts ?? [null, null],
    });
  return done.sort((a, b) => a.index - b.index);
}

/** The bank item id of a revealed question (the room calls it `factId` once the result is in). */
export const factIdOf = (q: RoomQuestion | null | undefined) => q?.factId ?? null;

// ---- names -------------------------------------------------------------------------------------------------

/** The opponent's display name: the bot is always "Babu-Bot · BOT". */
export function rivalName(room: Room): string {
  return seatName(room.players[other(room.seat)]);
}

// ---- time and margins ----------------------------------------------------------------------------------------

/** 0.42 s → "0.42 s"; 1.3 s → "1.3 s". Two decimals under a second so a 0.151 s gap never reads 0.2. */
export function seconds(ms: number): string {
  const s = Math.abs(ms) / 1000;
  return `${s < 1 ? s.toFixed(2) : s.toFixed(1)} s`;
}

export type Verdict = 'win' | 'loss' | 'draw' | 'cancelled';

export function verdictOf(room: Room): Verdict {
  if (room.phase === 'cancelled' || room.reason !== 'complete') return 'cancelled';
  if (room.winner === null) return 'draw';
  return room.winner === room.seat ? 'win' : 'loss';
}

/**
 * The one line under a round's stamp, only when it is true (bible §11.11): who was faster and by how
 * much (from the two receipts), a tie within the engine's window, or who alone was right.
 */
export function roundLine(
  round: Pick<DoneRound, 'result' | 'receipts'>,
  seat: Seat,
  rival: string,
  t: (en: string, hi?: string) => string,
): string | null {
  const r = round.result;
  if (!r) return null;
  const mine = round.receipts?.[seat] ?? null;
  const theirs = round.receipts?.[other(seat)] ?? null;
  switch (r.reason) {
    case 'screen-time': {
      if (!mine || !theirs) return null;
      const gap = seconds(theirs.elapsedMs - mine.elapsedMs);
      return r.winner === seat
        ? t(`You were ${gap} faster.`, `आप ${gap} तेज़ थे।`)
        : t(`${rival} was ${gap} faster.`, `${rival} ${gap} तेज़ था।`);
    }
    case 'close-result': {
      const tie = seconds(r.tieMs ?? 150);
      return t(`Tie — both right, within ${tie}.`, `बराबर — दोनों सही, ${tie} के अंदर।`);
    }
    case 'correct':
      return r.winner === seat
        ? t('Only you got it right.', 'सिर्फ़ आपका जवाब सही था।')
        : t(`Only ${rival} got it right.`, `सिर्फ़ ${rival} का जवाब सही था।`);
    case 'no-correct-answer':
      return t('Neither answer was right. No point.', 'दोनों जवाब ग़लत। कोई अंक नहीं।');
    case 'both-correct':
      return t('Both right — a shared round, no point.', 'दोनों सही — साझा राउंड, कोई अंक नहीं।');
    case 'timing-inconsistent':
      return t(
        'The timing checks did not pass. The match stopped.',
        'टाइमिंग जाँच पास नहीं हुई। मैच रुक गया।',
      );
    default:
      return null;
  }
}

/**
 * The match's true margin line (bible §11.12, N1): the closest decided speed round, if any —
 * "Round 3 went to Babu-Bot by 0.31 s." Null when no round was decided on time.
 */
export function marginLine(room: Room, t: (en: string, hi?: string) => string): string | null {
  const speed = settledRounds(room).filter(
    (r) => r.result?.reason === 'screen-time' && r.receipts?.[0] && r.receipts?.[1],
  );
  if (!speed.length) return null;
  const gap = (r: DoneRound) => Math.abs((r.receipts[0]?.elapsedMs ?? 0) - (r.receipts[1]?.elapsedMs ?? 0));
  const closest = speed.reduce((a, b) => (gap(b) < gap(a) ? b : a));
  const who = closest.result.winner === room.seat ? t('you', 'आप') : rivalName(room);
  return t(
    `Round ${closest.index + 1} went to ${who} by ${seconds(gap(closest))}.`,
    `राउंड ${closest.index + 1}: ${who}, ${seconds(gap(closest))} से।`,
  );
}

/** Why a match ended without a result — the engine's reason, in words. */
export function cancelReason(reason: string | null, t: (en: string, hi?: string) => string): string {
  switch (reason) {
    case 'player-left':
      return t(
        'A player left the room. No result, nothing recorded as a loss.',
        'एक खिलाड़ी रूम छोड़ गया। कोई नतीजा नहीं, हार दर्ज नहीं।',
      );
    case 'player-not-connected':
      return t(
        'A player could not open the question in time. No result.',
        'एक खिलाड़ी समय पर सवाल नहीं खोल पाया। कोई नतीजा नहीं।',
      );
    case 'timing-inconsistent':
      return t(
        'A reported answer time did not match the receipt time. No result.',
        'बताया गया समय रसीद के समय से मेल नहीं खाया। कोई नतीजा नहीं।',
      );
    case 'room-expired':
      return t('This room expired. No result.', 'यह रूम ख़त्म हो गया। कोई नतीजा नहीं।');
    case 'connection-lost':
      return t(
        'The connection to your friend was lost. No result.',
        'दोस्त से कनेक्शन टूट गया। कोई नतीजा नहीं।',
      );
    case 'p2p-mismatch':
      return t(
        'Your friend is on a different version of the game. Both of you reload and try again.',
        'दोस्त गेम के दूसरे वर्ज़न पर है। दोनों पेज रीलोड करके फिर कोशिश करें।',
      );
    case 'deal-mismatch':
      return t(
        'The questions did not match this room code, so the match was stopped.',
        'सवाल इस रूम कोड से मेल नहीं खाए, इसलिए मैच रोका गया।',
      );
    default:
      return t('This match ended before a result.', 'यह मैच नतीजे से पहले ख़त्म हो गया।');
  }
}

// ---- Surprise Audit (the engine's wild rounds, lib/progression.mjs wildRound) -------------------------

/** The XP multiplier the engine applies to a round id: 1, 2 (~1 in 6) or 3 (~1 in 36). */
export const auditOf = (roundId: string): 1 | 2 | 3 => wildRound(roundId) as 1 | 2 | 3;
/** Round ids are `${room.id}:${index}` (lib/server/room-engine.mjs beginRound). */
export const roundIdFor = (roomId: string, index: number) => `${roomId}:${index}`;

// ---- XP read back from the profile's log (lib/progression.mjs) ------------------------------------------

export type LogEntry = {
  id?: string;
  at: number;
  kind: string;
  xp: number;
  label: string;
  meta?: Record<string, unknown>;
};
export type XpLine = { xp: number; parts: string[] };

const mult = (n: number) => `×${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}`;

/** A round's XP words from the engine's own table: "base 20 · fast +15 · expert ×1.3 · combo ×1.25 · Surprise Audit ×2". */
function roundParts(e: LogEntry, correct: boolean, bot: boolean): string[] {
  const m = e.meta ?? {};
  if (m.scoring === 'stopwatch-v1') return [`answer ${e.xp} XP`, ...(typeof m.elapsedMs === 'number' ? [`${(m.elapsedMs / 1000).toFixed(1)} s`] : [])];
  const parts = [`base ${correct ? (bot ? XP.roundCorrectBot : XP.roundCorrectHuman) : XP.roundWrong}`];
  const ms = typeof m.elapsedMs === 'number' ? m.elapsedMs : null;
  if (correct && ms !== null) {
    if (ms < 2000) parts.push(`fast +${XP.speedFast}`);
    else if (ms < 4000) parts.push(`quick +${XP.speedQuick}`);
  }
  const diff =
    typeof m.difficulty === 'string'
      ? (DIFFICULTY_MULTIPLIER as Record<string, number>)[m.difficulty]
      : undefined;
  if (diff && diff !== 1) parts.push(`${m.difficulty} ${mult(diff)}`);
  const combo = typeof m.combo === 'number' ? m.combo : 0;
  if (combo >= 2) parts.push(`combo ${mult(comboMultiplier(combo))}`);
  const wild = typeof m.wild === 'number' ? m.wild : 1;
  if (wild > 1) parts.push(`Surprise Audit ×${wild}`);
  return parts;
}

/**
 * What one settled round paid, read from the profile's XP log: the round line (matchId + index) plus
 * the new-receipt XP the same write paid. Quests, streak days and Stamp Register entries belong to
 * the match result, not to a question's receipt. Null until the profile has filed it.
 */
export function xpForRound(
  log: readonly LogEntry[] | undefined,
  matchId: string,
  index: number,
  correct: boolean,
  bot: boolean,
): XpLine | null {
  if (!log) return null;
  const e = log.find((x) => x.kind === 'round' && x.meta?.matchId === matchId && x.meta?.index === index);
  if (!e) return null;
  const sameWrite = log.filter((x) => x.at === e.at);
  const rounds = sameWrite.filter((x) => x.kind === 'round');
  const facts = rounds.length === 1 ? sameWrite.filter((x) => x.kind === 'fact' && x.xp > 0) : [];
  const factXp = facts.reduce((s, x) => s + x.xp, 0);
  const audit = sameWrite.filter(x => x.meta?.bonus === 'surprise-audit' && x.meta?.matchId === matchId && x.meta?.index === index).reduce((sum, x) => sum + x.xp, 0);
  return {
    xp: e.xp + factXp + audit,
    parts: [...roundParts(e, correct, bot), ...(audit ? [`Surprise Audit bonus +${audit} XP`] : []), ...(factXp ? [`new receipt +${formatNumber(factXp)}`] : [])],
  };
}

type T = (en: string, hi?: string) => string;
const plain: T = (en) => en;

/** A non-round XP line in the edition's words (one mapping for every screen: data.xpLogWords). */
const extraLabel = (e: LogEntry, t: T): string => xpLogWords(e, t);

/** Everything a match paid: its rounds, the match line, and what those writes paid besides. */
export function xpForMatch(
  log: readonly LogEntry[] | undefined,
  matchId: string,
  t: T = plain,
): { total: number; lines: { label: string; xp: number }[] } | null {
  if (!log) return null;
  const own = log.filter((x) => x.meta?.matchId === matchId && (x.kind === 'round' || x.kind === 'match'));
  if (!own.length) return null;
  const ats = new Set(own.map((x) => x.at));
  const extras = log.filter((x) => ats.has(x.at) && x.kind !== 'round' && x.kind !== 'match' && x.xp > 0);
  const rounds = own.filter((x) => x.kind === 'round');
  const match = own.find((x) => x.kind === 'match');
  const lines: { label: string; xp: number }[] = [];
  if (rounds.length)
    lines.push({
      label:
        rounds.length === 1 ? t('Round', 'राउंड') : t(`${rounds.length} rounds`, `${rounds.length} राउंड`),
      xp: rounds.reduce((s, x) => s + x.xp, 0),
    });
  if (match) lines.push({ label: match.label, xp: match.xp });
  // One line per kind of extra (quests keep their own names), in a stable order.
  const byLabel = new Map<string, number>();
  for (const x of extras) byLabel.set(extraLabel(x, t), (byLabel.get(extraLabel(x, t)) ?? 0) + x.xp);
  for (const [label, xp] of byLabel) lines.push({ label, xp });
  return { total: lines.reduce((s, l) => s + l.xp, 0), lines };
}

// ---- receipt numbers (the same count as the tijori) -----------------------------------------------------

type Journal =
  | {
      facts?: Record<string, { firstAt?: number | null } | undefined>;
      rounds?: Array<{ factId?: string | null; at?: number | null }>;
    }
  | null
  | undefined;

/** A receipt's number: its place among every distinct fact the player has answered, first met first. */
export function receiptOrdinal(journal: Journal, factId: string | null): number | null {
  if (!factId) return null;
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
