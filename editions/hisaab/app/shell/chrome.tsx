/**
 * shell/chrome.tsx — how much shell a screen shows, and its document title.
 *
 *   useChrome('none');          // a live room: no top bar, no nav (the room draws its round header)
 *   useChrome(countdown ? 'none' : null);   // null = the route's default (router.ts)
 *   useScreenTitle('Rajya Rounds');         // document.title = 'Rajya Rounds · Andhbhakt ya Deshbhakt'
 *
 * The shell also hides the nav on its own while a ceremony is open.
 */
import { createContext, useContext, useEffect } from 'react';
import type { Chrome } from '../router';

export const ChromeContext = createContext<(mode: Chrome | null) => void>(() => {});

/** Override the route's default chrome while mounted (null = the default). */
export function useChrome(mode: Chrome | null) {
  const set = useContext(ChromeContext);
  useEffect(() => {
    set(mode);
    return () => set(null);
  }, [mode, set]);
}

export const TITLE_SUFFIX = 'Andhbhakt ya Deshbhakt';

/** Set document.title while mounted: '<title> · Andhbhakt ya Deshbhakt'. */
export function useScreenTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} · ${TITLE_SUFFIX}`;
    return () => {
      document.title = before;
    };
  }, [title]);
}
