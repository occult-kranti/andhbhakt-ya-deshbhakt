/**
 * editions/hisaab/engine/labels.mjs — the label ladder (charter §1).
 *
 * The engine's levels and title bands are unchanged (lib/progression.mjs: band = floor(level / 5),
 * nine bands, Rookie … Legend). This edition shows a label in place of the band title: you start as
 * an Andhbhakt and earn your way, receipt by receipt, to Certified Anti-National. The satire is aimed
 * at labelling and at blind devotion, never at a group. Order is fixed by the charter; the one-liners
 * are drafts the design lane may polish.
 */
export const LABELS = Object.freeze(
  [
    { band: 0, from: 1, to: 4, label: 'Andhbhakt', line: 'Forwards first. Reads never.' },
    { band: 1, from: 5, to: 9, label: 'WhatsApp University Fresher', line: 'Enrolled. Attendance: every group.' },
    { band: 2, from: 10, to: 14, label: 'Prime-Time Loyalist', line: "Knows the anchor's voice better than the budget." },
    { band: 3, from: 15, to: 19, label: 'Neutral Uncle', line: '"Sab chor hain." Has not checked which ones.' },
    { band: 4, from: 20, to: 24, label: 'Receipt Maango', line: 'Has started asking for the bill.' },
    { band: 5, from: 25, to: 29, label: 'RTI Warrior', line: 'Files questions. Waits 30 days.' },
    { band: 6, from: 30, to: 34, label: 'Urban Naxal (as per the forwards)', line: 'Reads CAG reports on the metro.' },
    { band: 7, from: 35, to: 39, label: 'Tukde-Tukde Gang', line: 'Counts crores in tukdas.' },
    { band: 8, from: 40, to: null, label: 'Certified Anti-National', line: 'Knows where the money went. Asks anyway.' },
  ].map((rung) => Object.freeze({ ...rung, ordinal: rung.band === 8 ? 10 : rung.band + 1 })),
);

/**
 * An earned competition honour occupies slot 9 without adding an XP band. Keep it out of LABELS:
 * no locked row, teaser or local-XP unlock. Call only with the current server API qualification.
 * This display validation is not authentication: the server owns rank, minimum matches and expiry.
 * A grant must be re-read after a competition refresh; a displaced top-ten player loses the grant.
 */
export function activeCompetitionTitle(grant, now = Date.now()) {
  if (!grant || typeof grant !== 'object' || !Number.isFinite(now)) return null;
  const { title, source, rank, competitionId, awardedAt, expiresAt } = grant;
  if (title !== 'desh-bhakt' || !['leaderboard', 'tournament'].includes(source)) return null;
  if (!Number.isInteger(rank) || rank < 1 || rank > 10) return null;
  if (typeof competitionId !== 'string' || !competitionId.trim() || competitionId.length > 128) return null;
  if (!Number.isFinite(awardedAt) || !Number.isFinite(expiresAt) || awardedAt > now || expiresAt <= now || expiresAt <= awardedAt) return null;
  return Object.freeze({
    id: title, ordinal: 9, label: 'Desh Bhakt', labelHi: 'देश भक्त',
    source, rank, competitionId, awardedAt, expiresAt,
  });
}

/** The rung for a progression band (lib/progression.mjs `levelForXp(xp).band`), clamped to the ladder. */
export function labelFor(band) {
  const i = Number.isInteger(band) ? Math.max(0, Math.min(LABELS.length - 1, band)) : 0;
  return LABELS[i];
}

/** The rung for a level, using the engine's own banding rule (floor(level / 5), capped). */
export function labelForLevel(level) {
  const l = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return labelFor(Math.min(LABELS.length - 1, Math.floor(l / 5)));
}
