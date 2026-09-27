import { STORAGE } from '../../../../lib/storage-names.mjs';

const MAX_IDS = 20_000;
const OUTCOMES = new Set(['win', 'loss', 'draw']);
export const emptyCadence = () => ({ version: 1, wins: 0, losses: 0, seen: [] });

function validState(state) {
  return state?.version === 1 && Number.isInteger(state.wins) && state.wins >= 0 && state.wins < 2
    && Number.isInteger(state.losses) && state.losses >= 0 && state.losses < 3
    && Array.isArray(state.seen) && state.seen.length <= MAX_IDS
    && state.seen.every((id) => typeof id === 'string' && id.length <= 300);
}

/** Mixed outcomes count independently until either threshold offers one natural break. */
export function reduceCompletion(state, completion) {
  const rejected = { state, recorded: false, due: false, reason: 'invalid' };
  if (!validState(state) || typeof completion?.id !== 'string' || !completion.id || completion.id.length > 240)
    return rejected;
  if (!['duel', 'practice'].includes(completion.kind)
    || (completion.kind === 'duel' && !OUTCOMES.has(completion.outcome))) return rejected;
  const id = `${completion.kind}:${completion.id}`;
  if (state.seen.includes(id)) return { ...rejected, reason: 'duplicate' };
  // Never evict old ids and turn a historical result into a new ad. Fail closed at the journal cap.
  if (state.seen.length >= MAX_IDS) return { ...rejected, reason: 'journal-full' };
  let { wins, losses } = state;
  let due = completion.kind === 'practice';
  if (completion.kind === 'duel' && completion.outcome === 'win') { wins += 1; if (wins === 2) due = true; }
  if (completion.kind === 'duel' && completion.outcome === 'loss') { losses += 1; if (losses === 3) due = true; }
  // Consume both tallies with an opportunity, even when consent/fill is unavailable. This
  // avoids back-to-back placements after alternating results or a period without ads.
  if (due && completion.kind === 'duel') { wins = 0; losses = 0; }
  return { state: { version: 1, wins, losses, seen: [...state.seen, id] }, recorded: true, due, reason: due ? 'placement-due' : 'counted' };
}

let memory = emptyCadence();
/** Persist before offering a placement. Blocked, corrupt or full storage skips ads, never gameplay. */
export async function recordCompletion(completion, options = {}) {
  const run = () => {
    let storage = options.storage;
    try {
      if (!storage && typeof window !== 'undefined') storage = window.localStorage;
      const raw = storage?.getItem(STORAGE.completionAds);
      const state = raw ? JSON.parse(raw) : memory;
      const result = reduceCompletion(state, completion);
      if (!result.recorded) return result;
      memory = result.state;
      if (!storage) return { ...result, due: false, reason: 'storage-unavailable' };
      storage.setItem(STORAGE.completionAds, JSON.stringify(result.state));
      return result;
    } catch {
      return { recorded: false, due: false, reason: 'storage-unavailable' };
    }
  };
  const locks = options.locks ?? (typeof navigator !== 'undefined' ? navigator.locks : null);
  // Web Locks serialize simultaneous result mounts in tabs on browsers that support them.
  if (typeof locks?.request === 'function') {
    try { return await locks.request(STORAGE.completionAds, run); }
    catch { return { recorded: false, due: false, reason: 'storage-unavailable' }; }
  }
  return run();
}
