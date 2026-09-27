/**
 * shell/theme.ts — Day / Night / Classic / Rotate editions / Match phone.
 *
 * The choice is stored per device under STORAGE.theme (never a literal key). <html data-theme> is
 * always the RESOLVED theme ('light' | 'dark' | 'classic'); `data-theme-pref` keeps the
 * choice. "Match phone" follows prefers-color-scheme live. main.tsx calls applyStoredTheme() before
 * the first render so there is no flash of the wrong theme.
 */
import { useSyncExternalStore } from 'react';
import { STORAGE } from '@/lib/storage-names.mjs';
import { rotatingEdition, themePreference } from '../../theme/preference.mjs';

export type ThemePref = 'light' | 'dark' | 'classic' | 'rotate' | 'system';
export type Theme = 'light' | 'dark' | 'classic';

// Freeze the daily rotation for this visit. Midnight never repaints an active question.
const visitEdition = rotatingEdition(Date.now()) as Theme;

const listeners = new Set<() => void>();
let pref: ThemePref | null = null;
let installed = false;

function read(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE.theme);
    return themePreference(v) as ThemePref;
  } catch {
    return 'system';
  }
}

const media = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

export function resolveTheme(p: ThemePref): Theme {
  if (p === 'rotate') return visitEdition;
  if (p !== 'system') return p;
  return media()?.matches ? 'dark' : 'light';
}

function apply() {
  if (typeof document === 'undefined') return;
  const p = pref ?? read();
  const root = document.documentElement;
  const resolved = resolveTheme(p);
  root.dataset.theme = resolved;
  root.dataset.themePref = p;
  // The browser chrome follows the page ground (once the tokens are loaded; index.html's two
  // media-queried tags cover the first paint). One tag, no media: the app's choice wins over the OS.
  const ground = getComputedStyle(root).getPropertyValue('--h-ground').trim();
  if (ground) {
    const tags = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    const meta = tags[0] ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    tags.forEach((t, i) => i > 0 && t.remove());
    meta.removeAttribute('media');
    meta.content = ground;
  }
}

/** Re-apply after the stylesheet has loaded (the shell calls it on mount). */
export const applyTheme = () => apply();

function notify() {
  apply();
  for (const fn of Array.from(listeners)) fn();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  media()?.addEventListener?.('change', () => {
    if ((pref ?? read()) === 'system') notify();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE.theme) {
      pref = read();
      notify();
    }
  });
}

/** Set the theme before React renders (main.tsx). */
export function applyStoredTheme() {
  pref = read();
  install();
  apply();
}

export function setTheme(next: ThemePref) {
  pref = themePreference(next) as ThemePref;
  try {
    localStorage.setItem(STORAGE.theme, pref);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  notify();
}

type Snapshot = { pref: ThemePref; resolved: Theme };
let snap: Snapshot = { pref: 'system', resolved: 'light' };
function getSnapshot(): Snapshot {
  const p = pref ?? read();
  const r = resolveTheme(p);
  if (snap.pref !== p || snap.resolved !== r) snap = { pref: p, resolved: r };
  return snap;
}
const SERVER: Snapshot = { pref: 'system', resolved: 'light' };

function subscribe(fn: () => void) {
  install();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useTheme() {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
  return { ...s, setTheme };
}
