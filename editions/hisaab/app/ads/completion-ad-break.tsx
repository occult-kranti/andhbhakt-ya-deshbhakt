import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [ready, setReady] = useState(false);
  const { ceremony, live, held } = useBudgetSnapshot();
  useEffect(() => {
    setDue(false);
    setReady(false);
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
    setReady(false);
    if (!due || ceremony || live || held) return;
    // Let the result and its short celebration finish; never compete with a promotion dialog.
    const timer = setTimeout(() => {
      if (document.hidden || document.querySelector('dialog[open], [aria-modal="true"]')) { setDue(false); return; }
      const context = { origin: window.location.origin, phase: 'completed', activeGame: false, online: navigator.onLine };
      if (gameAdEligibility(config, context, readAdConsent(window)).allowed) setReady(true);
      else setDue(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [due, ceremony, live, held]);

  if (!ready || !due || ceremony || live || held) return null;
  return createPortal(<GameBreak onClose={() => { setDue(false); setReady(false); }} />, document.body);
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
