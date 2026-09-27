/** The same deterministic daily edition is used by the game and its public pages. */
export function rotatingEdition(at = Date.now()) {
  const day = Math.floor((Number.isFinite(at) ? at : 0) / 86_400_000);
  return ['light', 'dark', 'classic'][((day % 3) + 3) % 3];
}

export function themePreference(value) {
  return ['light', 'dark', 'classic', 'rotate', 'system'].includes(value) ? value : 'system';
}
