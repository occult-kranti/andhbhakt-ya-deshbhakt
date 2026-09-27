import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sound } from '@/components/fx';
import { useBudgetSnapshot } from '../budget';
import { Button } from '../ui/button';
import { useLang } from '../ui/lang';
import { recordCompletion } from './cadence.mjs';
import { googleH5Provider, requestGameBreak } from './game-runtime.mjs';
import { gameAdEligibility, normalizeAdConfig } from './policy.mjs';
import { readAdConsent } from './runtime.mjs';
import './game-break.css';

declare const __HISAAB_ADS__: unknown;
const config = normalizeAdConfig(typeof __HISAAB_ADS__ === 'object' && __HISAAB_ADS__ !== null ? __HISAAB_ADS__ : {});
export type CompletionOutcome = 'win' | 'loss' | 'draw';
export type CompletionAdBreakProps = {
  /** Stable completed match/run id, including the player's seat for online duels. */
  completionId: string;
  kind: 'duel' | 'practice';
  outcome?: CompletionOutcome;
};

/** Mount on a terminal result only. A cancelled/abandoned match must never mount this component. */
export function CompletionAdBreak({ completionId, kind, outcome }: CompletionAdBreakProps) {
  const [due, setDue] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  const { ceremony, live, held } = useBudgetSnapshot();
  useEffect(() => {
    setDue(false);
    setOpen(false);
    let active = true;
    // The short deferral also avoids recording twice under React's development effect replay.
    const timer = setTimeout(() => {
      void recordCompletion({ id: completionId, kind, outcome }).then((result) => {
        if (active && result.due) setDue(true);
      });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [completionId, kind, outcome]);

  useEffect(() => {
    if (!due) return;
    const update = () => {
      const context = { origin: window.location.origin, phase: 'completed', activeGame: false, online: navigator.onLine };
      setEligible(gameAdEligibility(config, context, readAdConsent(window)).allowed);
    };
    update();
    let unsubscribe = () => {};
    try { unsubscribe = (window as Window & { hisaabAdConsent?: { subscribe: (listener: () => void) => () => void } }).hisaabAdConsent?.subscribe(update) ?? unsubscribe; }
    catch { setEligible(false); }
    window.addEventListener('hisaab:ad-consent-ready', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      unsubscribe();
      window.removeEventListener('hisaab:ad-consent-ready', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [due]);

  if (!due || !eligible || live || held) return null;
  return <>
    <div className="h-game-ad-entry">
      <span>{t('Optional ad break between games. Your result is saved.', 'खेलों के बीच वैकल्पिक विज्ञापन। आपका नतीजा दर्ज है।')}</span>
      <Button variant="paper" size="s" disabled={!!ceremony || open} onClick={() => {
        if (document.hidden || document.querySelector('dialog[open], [aria-modal="true"]')) return;
        setOpen(true);
      }}>{t('Continue', 'आगे')}</Button>
    </div>
    {open ? createPortal(<GameBreak onClose={() => { setOpen(false); setDue(false); }} />, document.body) : null}
  </>;
}

function GameBreak({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const dialog = useRef<HTMLDialogElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const cancel = useRef<() => void>(() => {});
  const [state, setState] = useState('loading');
  useEffect(() => {
    const node = dialog.current;
    if (!node || !container.current) return;
    const before = document.activeElement as HTMLElement | null;
    let active = true;
    // Native modal semantics trap focus, make the game inert and support keyboard dismissal.
    try { node.showModal(); } catch { close.current(); return; }
    const resumeSound = sound.pauseForAd();
    const placement = requestGameBreak({
      config,
      context: { origin: window.location.origin, phase: 'completed', activeGame: false, online: navigator.onLine },
      win: window,
      provider: googleH5Provider({ config, container: container.current, win: window, doc: document, sound: false, continueLabel: t('Continue', 'आगे') }),
      onState: (next: string) => { if (active) setState(next); },
    });
    cancel.current = placement.cancel;
    void placement.done.then(() => { if (active) close.current(); });
    const offline = () => placement.cancel();
    window.addEventListener('offline', offline);
    return () => {
      active = false;
      placement.cancel();
      resumeSound();
      window.removeEventListener('offline', offline);
      node.close();
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className="h-game-ad" aria-labelledby="h-game-ad-title" onCancel={() => cancel.current()}>
    <div className="h-game-ad__head">
      <div><h2 id="h-game-ad-title">{t('Advertisement', 'विज्ञापन')}</h2>
        <p role="status">{state === 'loading' ? t('Checking for an ad…', 'विज्ञापन खोज रहे हैं…') : state === 'ready' ? t('Continue to the ad break. Your result is saved.', 'विज्ञापन के लिए आगे बढ़ें। आपका नतीजा दर्ज है।') : t('Your result is saved.', 'आपका नतीजा दर्ज है।')}</p></div>
      <Button variant="paper" onClick={() => cancel.current()}>{t('Return to result', 'नतीजे पर वापस')}</Button>
    </div>
    <div ref={container} className="h-game-ad__body" />
  </dialog>;
}
