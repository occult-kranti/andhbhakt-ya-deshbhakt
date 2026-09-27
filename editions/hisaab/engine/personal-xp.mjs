/** Personal labels combine two cumulative totals; server competition rank never reads this display. */
const safeXp = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function personalXp(practiceXp, session) {
  const practice = safeXp(practiceXp);
  const online = typeof session?.id === 'string' && session.id.length > 0 ? safeXp(session.onlineXp) : 0;
  return Math.min(Number.MAX_SAFE_INTEGER, practice + online);
}
