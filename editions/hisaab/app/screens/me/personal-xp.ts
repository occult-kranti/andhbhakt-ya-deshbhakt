import { useEffect, useSyncExternalStore } from 'react';
import { personalXp } from '../../../engine/personal-xp.mjs';
import { online } from '../../../online/runtime';

let refresh: Promise<unknown> | null = null;
let refreshingFor: string | null = null;
const snapshot = () => online.session;
const serverSnapshot = () => null;

/** Read-only combined progress. Repeated server snapshots replace a total and never award local XP. */
export function usePersonalXp(practiceXp: number): number {
  const session = useSyncExternalStore(online.subscribe, snapshot, serverSnapshot);
  const identity = session?.id;
  useEffect(() => {
    if (!identity || !online.configured) return;
    // The masthead and profile may mount together. Share the same read.
    if (refresh && refreshingFor === identity) return;
    refreshingFor = identity;
    const request = online.request('profile').catch(() => undefined);
    refresh = request;
    void request.finally(() => { if (refresh === request) { refresh = null; refreshingFor = null; } });
  }, [identity]);
  return personalXp(practiceXp, session);
}
