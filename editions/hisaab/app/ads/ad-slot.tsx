import { useEffect, useRef, useState } from 'react';
import { adEligibility, normalizeAdConfig } from './policy.mjs';
import { mountAd, readAdConsent } from './runtime.mjs';
import './ads.css';

declare const __HISAAB_ADS__: unknown;
declare const __HISAAB_BASE__: string;
const config = normalizeAdConfig(typeof __HISAAB_ADS__ === 'object' && __HISAAB_ADS__ !== null ? __HISAAB_ADS__ : {});

type ConsentBridge = {
  getSnapshot: () => unknown;
  subscribe: (listener: () => void) => (() => void);
  openPreferences: () => void;
};
type AdWindow = Window & { hisaabAdConsent?: ConsentBridge };
type Placement = 'home-footer';

/** No placeholder, SDK or reserved gap in the normal, ads-off release. */
export function AdSlot({ placement, screen }: { placement: Placement; screen: 'home' }) {
  const element = useRef<HTMLModElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!config.enabled) return;
    const win = window as AdWindow;
    let unsubscribe: (() => void) | undefined;
    const update = () => setReady(adEligibility(config, {
      placement, screen, origin: win.location.origin, hash: win.location.hash,
    }, readAdConsent(win)).allowed);
    const attach = () => {
      unsubscribe?.();
      try { unsubscribe = win.hisaabAdConsent?.subscribe(update); } catch { setReady(false); return; }
      update();
    };
    attach();
    win.addEventListener('hisaab:ad-consent-ready', attach);
    win.addEventListener('hashchange', update);
    return () => {
      unsubscribe?.();
      win.removeEventListener('hisaab:ad-consent-ready', attach);
      win.removeEventListener('hashchange', update);
    };
  }, [placement, screen]);

  useEffect(() => {
    const node = element.current;
    if (!ready || failed || !node) return;
    let unmount = () => {};
    const show = () => { unmount = mountAd({ config, placement, screen, element: node, win: window, doc: document, onFailure: () => setFailed(true) }); };
    // Load once, only near a visible reserved slot. No timed refresh or rewarded impressions.
    if (!('IntersectionObserver' in window)) { show(); return () => unmount(); }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); show(); }
    }, { rootMargin: '100px 0px' });
    observer.observe(node);
    return () => { observer.disconnect(); unmount(); };
  }, [ready, failed, placement, screen]);

  if (!ready || failed) return null;
  return (
    <aside className="h-ad-space" data-ad-placement={placement} aria-label="Advertisements">
      <p className="h-ad-space__label">Advertisements</p>
      <ins ref={element} className="adsbygoogle h-ad-space__unit" data-ad-format="rectangle" data-full-width-responsive="false" />
    </aside>
  );
}

/** Crawlable publication information; absolute deployment base works on Pages and a custom domain. */
export function PublicationLinks() {
  const base = typeof __HISAAB_BASE__ === 'string' ? __HISAAB_BASE__ : '/';
  const [canManage, setCanManage] = useState(false);
  useEffect(() => {
    const update = () => setCanManage(config.enabled && typeof (window as AdWindow).hisaabAdConsent?.openPreferences === 'function');
    update();
    window.addEventListener('hisaab:ad-consent-ready', update);
    return () => window.removeEventListener('hisaab:ad-consent-ready', update);
  }, []);
  return (
    <nav className="h-publication-links" aria-label="Publication information">
      <a href={`${base}about.html`}>About</a>
      <a href={`${base}privacy.html`}>Privacy</a>
      <a href={`${base}contact.html`}>Contact & corrections</a>
      {canManage ? <button type="button" onClick={() => (window as AdWindow).hisaabAdConsent?.openPreferences()}>Ad privacy choices</button> : null}
    </nav>
  );
}
