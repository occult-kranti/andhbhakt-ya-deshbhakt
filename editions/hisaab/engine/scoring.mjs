/** HISAAB DO answer rewards. All records are device-local, never a trusted ranking. */
export const XP_BANDS = Object.freeze([
  Object.freeze({ beforeMs: 8000, xp: 30, label: 'Under 8 seconds' }),
  Object.freeze({ beforeMs: 15000, xp: 20, label: '8 to under 15 seconds' }),
  Object.freeze({ beforeMs: Infinity, xp: 10, label: '15 seconds or more' }),
]);
export function answerXp(correct, elapsedMs) {
  if (!correct) return 0;
  // Missing/invalid time never qualifies for a speed bonus, including imported legacy answers.
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 10;
  return XP_BANDS.find(b => elapsedMs < b.beforeMs).xp;
}
export const TIMED_ANSWER_XP = answerXp;
export const DUEL_DURATIONS = Object.freeze([5, 7, 10, 30]);
export const DUEL_MODE_DURATION = Object.freeze({ quick: 30, trilogy: 30, gauntlet: 30 });

/** The monotonic stopwatch continues in background tabs and locks once, before asynchronous work. */
export function createStopwatch(now = () => globalThis.performance.now()) {
  let start = null;
  let locked = null;
  let highWater = 0;
  return {
    start() { if (start === null) start = now(); },
    elapsed() {
      if (locked !== null) return locked;
      if (start === null) return 0;
      highWater = Math.max(highWater, Math.max(0, now() - start));
      return highWater;
    },
    lock() {
      if (start === null) return null;
      if (locked === null) locked = this.elapsed();
      return locked;
    },
    get started() { return start !== null; },
    get locked() { return locked !== null; },
  };
}
