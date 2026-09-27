/** HISAAB-only advertising gate. Importing this module makes no requests or storage writes. */
export const PLACEMENTS = Object.freeze({
  'home-footer': Object.freeze({ screen: 'home', slot: 'homeSlot' }),
});

export function normalizeAdConfig(raw = {}) {
  return Object.freeze({
    enabled: raw.enabled === true,
    approved: raw.approved === true,
    autoAdsDisabled: raw.autoAdsDisabled === true,
    client: typeof raw.client === 'string' ? raw.client : '',
    homeSlot: typeof raw.homeSlot === 'string' ? raw.homeSlot : '',
    cmpId: typeof raw.cmpId === 'string' ? raw.cmpId : '',
    origin: typeof raw.origin === 'string' ? raw.origin : '',
    h5Enabled: raw.h5Enabled === true,
    h5Approved: raw.h5Approved === true,
    h5Test: raw.h5Test === true,
  });
}

export function adConfigFromEnv(env = {}) {
  return normalizeAdConfig({
    enabled: env.HISAAB_ADS_ENABLED === 'true',
    approved: env.HISAAB_ADS_SITE_APPROVED === 'true',
    autoAdsDisabled: env.HISAAB_ADS_AUTO_ADS_DISABLED === 'true',
    client: env.HISAAB_ADS_CLIENT,
    homeSlot: env.HISAAB_ADS_HOME_SLOT,
    cmpId: env.HISAAB_ADS_CMP_ID,
    origin: env.HISAAB_ADS_ORIGIN,
    h5Enabled: env.HISAAB_ADS_H5_ENABLED === 'true',
    h5Approved: env.HISAAB_ADS_H5_APPROVED === 'true',
    h5Test: env.HISAAB_ADS_H5_TEST === 'true',
  });
}

/** No ads in circle, lobby, question, recap or result views, including future unknown screens. */
export function isAdRoute(hash) {
  return ['', '#', '#/'].includes(hash);
}

/**
 * Consent is supplied by the publisher's reviewed CMP adapter, never by a homemade accept button.
 * The stricter adult-only, explicit-consent policy is a product choice, not a legal conclusion.
 */
export function adEligibility(config, context, consent) {
  const deny = (reason) => Object.freeze({ allowed: false, reason, slot: null });
  if (!config?.enabled) return deny('disabled');
  if (!config.approved) return deny('site-not-approved');
  if (!config.autoAdsDisabled) return deny('auto-ads-not-disabled');
  if (!/^ca-pub-\d{16}$/.test(config.client)) return deny('invalid-publisher');
  if (!config.cmpId || config.cmpId.length > 100) return deny('cmp-not-configured');
  let origin;
  try { origin = new URL(config.origin); } catch { return deny('invalid-origin'); }
  if (origin.protocol !== 'https:' || origin.origin !== config.origin || context?.origin !== config.origin) return deny('wrong-origin');
  if (!Object.hasOwn(PLACEMENTS, context?.placement ?? '')) return deny('unknown-placement');
  const placement = PLACEMENTS[context.placement];
  if (context.screen !== placement.screen || !isAdRoute(context.hash)) return deny('active-or-unknown-screen');
  if (context.activeGame === true || context.familySession === true) return deny('protected-session');
  const slot = config[placement.slot];
  if (!/^\d{10}$/.test(slot ?? '')) return deny('missing-slot');
  if (consent?.status !== 'ready' || consent.providerId !== config.cmpId) return deny('cmp-not-ready');
  if (consent.advertisingAllowed !== true || consent.storageAllowed !== true || consent.regionalRulesSatisfied !== true) return deny('no-consent');
  if (consent.audience !== 'adult') return deny('protected-audience');
  return Object.freeze({ allowed: true, reason: 'ready', slot });
}

export function adsTxt(config) {
  return /^ca-pub-\d{16}$/.test(config?.client ?? '')
    ? `google.com, ${config.client.slice(3)}, DIRECT, f08c47fec0942fa0\n`
    : null;
}

/** H5 placements have their own approval and only run after a completed game. */
export function gameAdEligibility(config, context, consent) {
  // Reuse publisher, origin and CMP rules, not the home display unit or its route allowlist.
  const publisher = adEligibility({ ...config, homeSlot: '0000000000' }, {
    ...context, placement: 'home-footer', screen: 'home', hash: '#/',
  }, consent);
  if (!publisher.allowed) return publisher;
  if (!config.h5Enabled) return { allowed: false, reason: 'h5-disabled' };
  if (!config.h5Approved) return { allowed: false, reason: 'h5-not-approved' };
  if (context?.phase !== 'completed' || context.activeGame !== false)
    return { allowed: false, reason: 'game-not-complete' };
  if (context.online === false) return { allowed: false, reason: 'offline' };
  return { allowed: true, reason: 'ready' };
}
