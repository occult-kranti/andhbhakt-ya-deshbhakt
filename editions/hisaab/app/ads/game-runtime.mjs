import { gameAdEligibility } from './policy.mjs';
import { readAdConsent } from './runtime.mjs';

/** A bounded placement lifecycle. Disposing the provider ends all SDK activity before gameplay resumes. */
export function requestGameBreak({ config, context, win, provider, onState = (_state) => {}, loadTimeoutMs = 4000, showTimeoutMs = 90_000 }) {
  const gate = gameAdEligibility(config, context, readAdConsent(win));
  if (!gate.allowed) return { done: Promise.resolve({ status: gate.reason }), cancel() {} };
  let finished = false;
  let timer;
  let dispose = () => {};
  let unsubscribe = () => {};
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const finish = (status) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { dispose(); } catch { /* Resume even if a host cannot reload. */ }
    try { unsubscribe(); } catch { /* A broken CMP must not hold the result. */ }
    onState('done');
    resolveDone({ status });
  };
  timer = setTimeout(() => finish('timeout'), loadTimeoutMs);
  onState('loading');
  try {
    unsubscribe = win.hisaabAdConsent.subscribe(() => {
      if (!gameAdEligibility(config, context, readAdConsent(win)).allowed) finish('consent-changed');
    });
    if (finished) unsubscribe();
    else if (!gameAdEligibility(config, context, readAdConsent(win)).allowed) finish('consent-changed');
    if (!finished) {
      const stop = provider.start({
        ready() {
          if (finished) return;
          clearTimeout(timer);
          timer = setTimeout(() => finish('timeout'), showTimeoutMs);
          onState('ready');
        },
        beforeAd() {
          if (finished) return;
          clearTimeout(timer);
          timer = setTimeout(() => finish('timeout'), showTimeoutMs);
          onState('showing');
        },
        done(info) { finish(info?.breakStatus ?? 'unavailable'); },
        error() { finish('unavailable'); },
      });
      dispose = typeof stop === 'function' ? stop : () => {};
      // A blocked provider may synchronously settle while start() is still returning its disposer.
      if (finished) dispose();
    }
  } catch { finish('unavailable'); }
  return { done, cancel: () => finish('cancelled') };
}

/**
 * Google H5 runs in the game document and adBreak is called directly by a Continue click.
 * Leaving an SDK-backed break reloads the saved result. Removing a script cannot unload SDK timers.
 */
export function googleH5Provider({ config, container, win, doc, sound = false, continueLabel = 'Continue' }) {
  return {
    start(callbacks) {
      let disposed = false;
      let loaded = false;
      let requested = false;
      const script = doc.createElement('script');
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'h-game-ad__continue';
      button.textContent = continueLabel;
      button.disabled = true;
      container.appendChild(button);
      const queue = win.adsbygoogle || [];
      win.adsbygoogle = queue;
      queue.requestNonPersonalizedAds = 1;
      const adBreak = (value) => win.adsbygoogle.push(value);
      const onClick = () => {
        if (disposed || requested || button.disabled) return;
        requested = true;
        button.disabled = true;
        adBreak({ type: 'next', name: 'completed-game',
          beforeAd: () => { if (!disposed) callbacks.beforeAd(); },
          adBreakDone: (info) => { if (!disposed) callbacks.done(info); },
        });
      };
      button.addEventListener('click', onClick);
      // This config does not display an ad; a real, direct user gesture above requests the placement.
      adBreak({ sound: sound ? 'on' : 'off', preloadAdBreaks: 'on', onReady: () => {
        if (disposed) return;
        button.disabled = false;
        callbacks.ready?.();
        button.focus({ preventScroll: true });
      } });
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`;
      script.setAttribute('data-ad-client', config.client);
      if (config.h5Test) script.setAttribute('data-adbreak-test', 'on');
      script.onerror = () => { if (!disposed) callbacks.error(); };
      loaded = true;
      doc.head.appendChild(script);
      return () => {
        if (disposed) return;
        disposed = true;
        button.removeEventListener('click', onClick);
        button.remove();
        script.remove();
        // Cadence was persisted before this SDK loaded. Reload cannot show the same placement again.
        if (loaded) win.location.reload();
      };
    },
  };
}
