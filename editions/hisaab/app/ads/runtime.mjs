import { adEligibility, isAdRoute } from './policy.mjs';

const runtimes = new WeakMap();

/** Read only the documented CMP bridge; missing, malformed and throwing bridges deny all ads. */
export function readAdConsent(win) {
  try {
    const bridge = win?.hisaabAdConsent;
    if (typeof bridge?.getSnapshot !== 'function' || typeof bridge?.subscribe !== 'function' || typeof bridge?.openPreferences !== 'function') return null;
    return bridge.getSnapshot();
  } catch { return null; }
}

/**
 * Registers a single manual display ad. No SDK, preload, cookies or ad queue before the gate.
 * Route changes out of reading screens hard-reload after an SDK was loaded: a third-party SDK
 * cannot be reliably unloaded by removing its script tag. The new gameplay document loads none.
 */
export function mountAd({ config, placement, screen, element, win, doc, onFailure = () => {} }) {
  let disposed = false;
  const eligibility = () => adEligibility(config, {
    placement, screen, origin: win.location.origin, hash: win.location.hash,
  }, readAdConsent(win));
  const initial = eligibility();
  if (!initial.allowed || !element?.isConnected) return () => {};

  let runtime = runtimes.get(win);
  if (!runtime) {
    runtime = { loaded: false, promise: null, unsubscribe: null };
    runtimes.set(win, runtime);
    win.addEventListener('hashchange', () => {
      if (runtime.loaded && !isAdRoute(win.location.hash)) win.location.reload();
    });
    // Revocation removes the entire advertising document, including third-party listeners/timers.
    const consentChanged = () => {
      const consent = readAdConsent(win);
      if (runtime.loaded && (consent?.status !== 'ready' || consent.providerId !== config.cmpId || consent.advertisingAllowed !== true || consent.storageAllowed !== true || consent.regionalRulesSatisfied !== true || consent.audience !== 'adult')) win.location.reload();
    };
    try { runtime.unsubscribe = win.hisaabAdConsent.subscribe(consentChanged); }
    catch { runtimes.delete(win); onFailure(); return () => {}; }
  }
  if (!runtime.promise) {
    // Re-check after subscribe: a bridge may have synchronously reported a withdrawal.
    if (!eligibility().allowed) return () => {};
    runtime.promise = new Promise((resolve, reject) => {
      const script = doc.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`;
      script.dataset.hisaabAds = 'manual';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Ad script unavailable'));
      // This conservative flag is set before insertion: a partly loaded SDK is still third-party code.
      runtime.loaded = true;
      doc.head.appendChild(script);
    });
  }
  element.setAttribute('data-ad-client', config.client);
  element.setAttribute('data-ad-slot', initial.slot);
  // Non-personalized by product policy. This does not replace the consent gate or CMP signals.
  Promise.resolve(runtime.promise).then(() => {
    if (disposed || !element.isConnected || !eligibility().allowed) return;
    if (element.dataset.hisaabRequested === 'true') return;
    element.dataset.hisaabRequested = 'true';
    const queue = win.adsbygoogle || [];
    win.adsbygoogle = queue;
    queue.requestNonPersonalizedAds = 1;
    queue.push({});
  }).catch(() => { if (!disposed) onFailure(); });
  return () => { disposed = true; };
}
