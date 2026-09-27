/** Shared validation/transport boundary. Match authority lives in the Postgres RPC. */
export const SERVER_RULES = Object.freeze({ rounds: 5, roundMs: 30000, countdownMs: 2500, breakMs: 10000, tieMs: 120, sessionDays: 30, minimumMatches: 3, minimumOpponents: 3 });
export const ACTIONS = new Set(['session', 'deleteSession', 'profile', 'create', 'join', 'queue', 'snapshot', 'ready', 'answer', 'next', 'leave', 'leaderboards', 'leaderboard', 'tournaments', 'circles']);
export class GameError extends Error { constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; } }
export function cleanNickname(value) {
  if (typeof value !== 'string') throw new GameError('BAD_NICKNAME', 'Choose a nickname.');
  const name = value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  if ([...name].length < 2 || [...name].length > 24) throw new GameError('BAD_NICKNAME', 'Use 2–24 characters for your nickname.');
  return name;
}
export function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !ACTIONS.has(body.action)) throw new GameError('BAD_ACTION', 'Unknown game action.');
  const payload = { ...body }; delete payload.action;
  // Never accept identity, timing, scores or answers supplied as assertions.
  for (const key of ['sessionId','playerId','elapsedMs','correct','score','xp','correctIndex','serverNow','tokenHash']) delete payload[key];
  if (body.action === 'session' || (body.action === 'profile' && payload.nickname != null)) payload.nickname = cleanNickname(payload.nickname);
  if (payload.nickname != null) payload.nickname = cleanNickname(payload.nickname);
  if (payload.roomId != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.roomId)) throw new GameError('BAD_ROOM', 'Invalid room.');
  if (['snapshot','ready','answer','next','leave'].includes(body.action) && !payload.roomId) throw new GameError('BAD_ROOM','A room is required.');
  if (body.action === 'answer' && (!Number.isInteger(payload.choice) || payload.choice < 0 || payload.choice > 3 || !Number.isInteger(payload.round) || payload.round < 1 || payload.round > 5 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId || ''))) throw new GameError('BAD_ANSWER', 'Choose one answer for the current round.');
  if (payload.code != null) { payload.code = String(payload.code).trim().toUpperCase(); if (!/^[A-F0-9]{8,16}$/.test(payload.code)) throw new GameError('BAD_CODE','Check the invite code.'); }
  return { action: body.action === 'leaderboard' ? 'leaderboards' : body.action, payload };
}
export function makeToken(random = crypto.getRandomValues.bind(crypto)) { return Array.from(random(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); }
export async function hashToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new GameError('UNAUTHORIZED', 'Your online profile is missing. Create a new one.', 401);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2,'0')).join('');
}
export function roundWinner(answers, tieMs = 120) {
  const right = answers.filter(a => a.correct);
  if (right.length === 1) return right[0].playerId;
  if (right.length !== 2 || Math.abs(right[0].elapsedMs - right[1].elapsedMs) <= tieMs) return null;
  return right[0].elapsedMs < right[1].elapsedMs ? right[0].playerId : right[1].playerId;
}
export function stopwatchXp(correct, elapsedMs) { return !correct ? 0 : elapsedMs < 8000 ? 30 : elapsedMs < 15000 ? 20 : 10; }
