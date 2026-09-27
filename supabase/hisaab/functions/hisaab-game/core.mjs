/** Shared validation/transport boundary. Match authority lives in the Postgres RPC. */
export const SERVER_RULES = Object.freeze({ rounds: 5, roundMs: 30000, countdownMs: 2500, breakMs: 10000, tieMs: 120, sessionDays: 30, minimumMatches: 3, minimumOpponents: 3 });
export const ECONOMY_RULES = Object.freeze({ startingBalance: 100, maxStake: 10000, completionReward: 10, bonusMultiplier: 10, rewardAnswers: 3, rewardCorrect: 1, rewardsPerFileUtcDay: 1, disconnectGraceMs: 90000 });
export const DUEL_FILES = Object.freeze([
 { id: 'all', name: 'Any file', rewardMultiplier: 1 },
 { id: 'today', name: 'Today’s file', rewardMultiplier: 1 },
 { id: 'subsidies', name: 'Subsidies', rewardMultiplier: 10 },
 { id: 'pre-election', name: 'Pre-election', rewardMultiplier: 10 },
 { id: 'media', name: 'Who owns media?', rewardMultiplier: 10 },
].map(Object.freeze));
export const ACTIONS = new Set(['session', 'recover', 'rotateRecovery', 'exportProfile', 'deleteSession', 'profile', 'create', 'join', 'queue', 'snapshot', 'ready', 'answer', 'next', 'leave', 'leaderboards', 'leaderboard', 'tournaments', 'circles']);
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
  for (const key of ['sessionId','playerId','elapsedMs','correct','score','xp','correctIndex','serverNow','tokenHash','balance','savings','reward','rewardMultiplier','payout','winnerId']) delete payload[key];
  delete payload._recoveryHash;
  if (['session','profile'].includes(body.action)) {
    if (payload.email != null) {
      if (typeof payload.email !== 'string') throw new GameError('BAD_EMAIL','Enter a valid email address.');
      payload.email = payload.email.trim().toLowerCase();
      if (payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new GameError('BAD_EMAIL','Enter a valid email address.');
    }
    if (payload.adultConfirmed != null && payload.adultConfirmed !== true) throw new GameError('AGE_CONFIRMATION_REQUIRED','Confirm that you are at least 18.');
    if (payload.termsVersion != null && payload.termsVersion !== 'beta-1') throw new GameError('TERMS_REQUIRED','Accept the current beta terms.');
    if (payload.avatar != null && !['spark','shield','bolt','star','book','compass'].includes(payload.avatar)) throw new GameError('BAD_AVATAR','Choose a supported avatar.');
    if (payload.locale != null && !['en','hi'].includes(payload.locale)) throw new GameError('BAD_LOCALE','Choose a supported language.');
    if (payload.preferences != null && (typeof payload.preferences !== 'object' || Array.isArray(payload.preferences) || Object.keys(payload.preferences).some(key => !['sound','reducedMotion'].includes(key)) || Object.values(payload.preferences).some(value => typeof value !== 'boolean'))) throw new GameError('BAD_PREFERENCES','Choose supported preferences.');
    if (body.action === 'session' && (!payload.email || payload.adultConfirmed !== true || payload.termsVersion !== 'beta-1')) throw new GameError('PROFILE_REQUIRED','Email, 18+ confirmation and beta terms are required.');
  }
  if (body.action === 'recover') {
    if (!/^[a-f0-9]{64}$/.test(payload.recoveryCode || '')) throw new GameError('BAD_RECOVERY','The recovery code is invalid.');
    payload.recoveryCode = undefined;
  }
  if (body.action === 'session' || (body.action === 'profile' && payload.nickname != null)) payload.nickname = cleanNickname(payload.nickname);
  if (payload.nickname != null) payload.nickname = cleanNickname(payload.nickname);
  if (payload.roomId != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.roomId)) throw new GameError('BAD_ROOM', 'Invalid room.');
  if (['snapshot','ready','answer','next','leave'].includes(body.action) && !payload.roomId) throw new GameError('BAD_ROOM','A room is required.');
  if (body.action === 'answer' && (!Number.isInteger(payload.choice) || payload.choice < 0 || payload.choice > 3 || !Number.isInteger(payload.round) || payload.round < 1 || payload.round > 5 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId || ''))) throw new GameError('BAD_ANSWER', 'Choose one answer for the current round.');
  if (payload.stake != null && (!Number.isSafeInteger(payload.stake) || payload.stake < 0 || payload.stake > ECONOMY_RULES.maxStake)) throw new GameError('BAD_STAKE', 'Choose whole units from 0 to 10,000.');
  if (['create', 'queue'].includes(body.action)) {
    payload.stake = payload.stake ?? 0; payload.file = payload.file ?? 'all';
    if (!DUEL_FILES.some(file => file.id === payload.file)) throw new GameError('BAD_FILE', 'Choose an available file.');
  }
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

// Bind recovery secrets to this game so a code cannot authenticate on another game.
export async function hashRecovery(code) {
  if (!/^[a-f0-9]{64}$/.test(code || '')) throw new GameError('BAD_RECOVERY','The recovery code is invalid.');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hisaab:recovery:' + code))), b => b.toString(16).padStart(2,'0')).join('');
}
