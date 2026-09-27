import { useEffect, useState, useSyncExternalStore } from 'react';
import { online } from '../../../online/runtime';
import { activeCompetitionTitle } from '../../../engine/labels.mjs';
import type { TitleGrant } from '../../../online/types';

/** Never persist honours: a fresh server profile owns eligibility, displacement and expiry. */
export function useCompetitionTitle(): TitleGrant | null {
  const session = useSyncExternalStore(online.subscribe, () => online.session, () => null);
  const identity = session?.id;
  const [grant, setGrant] = useState<TitleGrant | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0); const [now, setNow] = useState(online.now());
  useEffect(() => {
    setGrant(null); setOwner(null); setUpdatedAt(0);
    if (!online.configured || !identity) return;
    let live = true; let controller: AbortController | null = null;
    const refresh = () => {
      if (document.hidden) return;
      const identity = online.session?.id;
      if (!identity) { setGrant(null); setOwner(null); return; }
      controller?.abort(); controller = new AbortController();
      online.request('profile', {}, { signal: controller.signal }).then((data: { session?: { title?: TitleGrant } }) => {
        if (!live || online.session?.id !== identity) return;
        setOwner(identity); setGrant(data.session?.title ?? null); setUpdatedAt(online.now());
      }).catch(() => { if (live) setGrant(null); });
    };
    refresh();
    const poll = setInterval(refresh, 30000); const tick = setInterval(() => setNow(online.now()), 1000);
    document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh);
    return () => { live = false; controller?.abort(); clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, [identity]);
  return owner === identity && updatedAt && now - updatedAt < 35000 && activeCompetitionTitle(grant, now) ? grant : null;
}
