/**
 * editions/hisaab/app/router.ts — the edition's tiny hash router.
 *
 *   import { useRoute, navigate, Link, href } from '@/editions/hisaab/app/router';
 *   const route = useRoute();                // { name, view, params, query, path, tab, chrome }
 *   navigate('#/files/states?s=UP');         // or navigate(href.route('state-up'))
 *   <Link to={href.taster('hsc001')}>Try one card</Link>
 *
 * Hash routing because the edition is a static GitHub Pages site under a sub-path: every URL works on
 * reload without a server rewrite. Routes are `#/<path>?<query>`. Two share-link shorthands from the
 * design bible §8.4 are accepted too: `#q=<id>` (the one-card taster) and `#aaj` (today's file).
 *
 * Pure apart from `window`: `parseHash` is a plain function (tests/hisaab-ui-foundation.test.mjs runs
 * it in node). No JSX here, so the module also loads in node; `Link` is built with createElement.
 */
import { createElement, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** Every screen module under editions/hisaab/app/screens/<name>/index.tsx (plus two dev-only views). */
export type ScreenName =
  | 'home'
  | 'start'
  | 'files'
  | 'money'
  | 'ledger'
  | 'route'
  | 'aaj'
  | 'taster'
  | 'duel'
  | 'online'
  | 'circles'
  | 'pass'
  | 'room'
  | 'receipts'
  | 'me'
  | 'settings'
  | 'rules'
  | 'dev'
  | 'not-found';

/** Which bottom-bar / rail item is current for a screen. */
export type NavTab = 'home' | 'files' | 'duel' | 'circles' | 'receipts' | 'me' | null;

/**
 * How much shell chrome a screen gets by default (a screen can change it at run time with
 * `useChrome` from shell/chrome.tsx):
 *  - 'full': top bar + bottom bar (phone) / rail (≥ 900px)
 *  - 'top': top bar only (first run)
 *  - 'none': nothing — live rooms, pass-and-play and the dev shell draw their own header
 */
export type Chrome = 'full' | 'top' | 'none';

export type AppRoute = Readonly<{
  name: ScreenName;
  /**
   * The sub-view inside a screen module, or null. files: 'hub' | 'states' | 'sectors' | 'media' |
   * 'forwards'. money: 'hub' | 'distribution' | 'relief' | 'pre-election' | 'years'. duel: 'setup' |
   * 'friend'. me: 'profile' | 'certificate'. dev: 'engine' | 'ui' | 'three'.
   */
  view: string | null;
  /** Path parameters: `id` for #/route/:id and #/q/:id. */
  params: Readonly<Record<string, string>>;
  /** The query after `?` inside the hash, e.g. #/files/states?s=UP → { s: 'UP' }. */
  query: Readonly<Record<string, string>>;
  /** Normalised path without the query, e.g. '/files/states'. The visit key for the notification budget. */
  path: string;
  /** The raw hash as read (for debugging and "copy link"). */
  hash: string;
  tab: NavTab;
  chrome: Chrome;
}>;

/** Props every screen component receives. */
export type ScreenProps = { route: AppRoute };

type Rule = {
  pattern: RegExp;
  name: ScreenName;
  view?: string | null;
  keys?: string[];
  tab: NavTab;
  chrome?: Chrome;
};

const ID = '([A-Za-z0-9_-]{1,80})';

/** The route table, first match wins. Keep in step with app/README.md. */
const RULES: readonly Rule[] = [
  { pattern: /^\/?$/, name: 'home', tab: 'home' },
  { pattern: /^\/start$/, name: 'start', tab: null, chrome: 'top' },
  { pattern: /^\/files$/, name: 'files', view: 'hub', tab: 'files' },
  { pattern: /^\/files\/(states|sectors|media|forwards)$/, name: 'files', keys: ['view'], tab: 'files' },
  { pattern: /^\/money$/, name: 'money', view: 'hub', tab: 'files' },
  { pattern: /^\/money\/(distribution|relief|pre-election|years)$/, name: 'money', keys: ['view'], tab: 'files' },
  // Paisa Kahan Gaya? — the money ledger (screens/ledger). Filters ride in the query (mode, level, s, p, era, q, v, sort).
  { pattern: /^\/money\/ledger$/, name: 'ledger', tab: 'files' },
  { pattern: new RegExp(`^/route/${ID}$`), name: 'route', keys: ['id'], tab: 'files' },
  { pattern: /^\/aaj$/, name: 'aaj', tab: 'home' },
  { pattern: new RegExp(`^/q/${ID}$`), name: 'taster', keys: ['id'], tab: 'home' },
  { pattern: /^\/online$/, name: 'online', view: 'play', tab: 'duel' },
  { pattern: /^\/online\/(standings|circles)$/, name: 'online', keys: ['view'], tab: 'duel' },
  { pattern: /^\/duel$/, name: 'online', view: 'play', tab: 'duel' },
  { pattern: /^\/circles$/, name: 'circles', tab: 'circles' },
  { pattern: /^\/circles\/([a-f0-9]{32})$/, name: 'circles', keys: ['id'], tab: 'circles' },
  { pattern: /^\/duel\/friend$/, name: 'duel', view: 'friend', tab: 'duel' },
  { pattern: /^\/duel\/pass$/, name: 'pass', tab: 'duel', chrome: 'none' },
  { pattern: /^\/room$/, name: 'room', tab: 'duel', chrome: 'none' },
  { pattern: /^\/receipts$/, name: 'receipts', tab: 'receipts' },
  { pattern: /^\/me$/, name: 'me', view: 'profile', tab: 'me' },
  { pattern: /^\/me\/certificate$/, name: 'me', view: 'certificate', tab: 'me' },
  { pattern: /^\/settings$/, name: 'settings', tab: 'me' },
  { pattern: /^\/rules$/, name: 'rules', tab: 'me' },
  // Engine debugging only; never linked from the UI.
  { pattern: /^\/dev$/, name: 'dev', view: 'engine', tab: null, chrome: 'none' },
  { pattern: /^\/dev\/ui$/, name: 'dev', view: 'ui', tab: null },
  { pattern: /^\/dev\/three$/, name: 'dev', view: 'three', tab: null },
];

function parseQuery(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text) return out;
  for (const part of text.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      if (key && !Object.hasOwn(out, key)) out[key] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      /* a malformed escape: skip that pair */
    }
  }
  return out;
}

/** Turn any location.hash ('', '#', '#/', '#/files/states?s=UP', '#q=hsc001', '#aaj') into a route. */
export function parseHash(hash: string): AppRoute {
  const raw = typeof hash === 'string' ? hash : '';
  let body = raw.startsWith('#') ? raw.slice(1) : raw;
  // Share shorthands from the bible (§8.4): #q=<id> and #aaj.
  const short = /^q=([A-Za-z0-9_-]{1,80})$/.exec(body);
  if (short) body = `/q/${short[1]}`;
  else if (body === 'aaj') body = '/aaj';
  const q = body.indexOf('?');
  let path = q === -1 ? body : body.slice(0, q);
  const query = Object.freeze(parseQuery(q === -1 ? '' : body.slice(q + 1)));
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  for (const rule of RULES) {
    const m = rule.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    let view = rule.view ?? null;
    (rule.keys ?? []).forEach((key, i) => {
      if (key === 'view') view = m[i + 1];
      else params[key] = m[i + 1];
    });
    return Object.freeze({
      name: rule.name,
      view,
      params: Object.freeze(params),
      query,
      path: path === '' ? '/' : path,
      hash: raw,
      tab: rule.tab,
      chrome: rule.chrome ?? 'full',
    });
  }
  return Object.freeze({
    name: 'not-found',
    view: null,
    params: Object.freeze({}),
    query,
    path,
    hash: raw,
    tab: null,
    chrome: 'full',
  });
}

/** Build a query string ('?a=1&b=2') from a record, skipping empty values; '' when nothing is left. */
export function queryString(query?: Record<string, string | number | null | undefined>): string {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Hash hrefs for every screen — use these instead of writing '#/…' strings by hand. */
export const href = Object.freeze({
  home: () => '#/',
  start: () => '#/start',
  files: (view?: 'states' | 'sectors' | 'media' | 'forwards', query?: Record<string, string>) =>
    `#/files${view ? `/${view}` : ''}${queryString(query)}`,
  money: (view?: 'distribution' | 'relief' | 'pre-election' | 'years', query?: Record<string, string | number>) =>
    `#/money${view ? `/${view}` : ''}${queryString(query)}`,
  /** The money ledger, #/money/ledger?mode=relief&s=UP… (query keys: screens/ledger/lib.ts QUERY_KEYS). */
  ledger: (query?: Record<string, string | number>) => `#/money/ledger${queryString(query)}`,
  route: (id: string) => `#/route/${encodeURIComponent(id)}`,
  aaj: () => '#/aaj',
  taster: (id: string) => `#/q/${encodeURIComponent(id)}`,
  online: (view: 'play' | 'standings' | 'circles' = 'play', query?: Record<string, string>) => `#/online${view === 'play' ? '' : `/${view}`}${queryString(query)}`,
  duel: (query?: Record<string, string>) => `#/online${queryString(query ? Object.fromEntries(Object.entries(query).filter(([key]) => key !== 'vs')) : undefined)}`,
  circles: (id?: string) => `#/circles${id ? `/${encodeURIComponent(id)}` : ''}`,
  /** The P2P lobby; with a code it opens the join form pre-filled. */
  friend: (code?: string) => `#/duel/friend${queryString({ code })}`,
  pass: () => '#/duel/pass',
  room: () => '#/room',
  receipts: (query?: Record<string, string>) => `#/receipts${queryString(query)}`,
  me: () => '#/me',
  certificate: () => '#/me/certificate',
  settings: () => '#/settings',
  rules: (section?: string) => `#/rules${queryString({ s: section })}`,
});

/**
 * An absolute URL for a hash route, for shares and invites: origin + the deployment base + hash.
 * `base` defaults to EDITION.base (pass it explicitly in node).
 */
export function absoluteUrl(hash: string, base?: string, origin?: string): string {
  const o = origin ?? (typeof location === 'undefined' ? '' : location.origin);
  const b = base ?? (typeof __HISAAB_BASE__ === 'string' ? __HISAAB_BASE__ : '/');
  const h = hash.startsWith('#') ? hash : `#${hash.startsWith('/') ? hash : `/${hash}`}`;
  return `${o}${b.endsWith('/') ? b : `${b}/`}${h}`;
}
declare const __HISAAB_BASE__: string | undefined;

// ---- the live location ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let current: AppRoute | null = null;
let installed = false;
/** True once the hash has changed since load (see goBack). */
let moved = false;

function readLocation(): AppRoute {
  const hash = typeof location === 'undefined' ? '' : location.hash;
  if (!current || current.hash !== hash) current = parseHash(hash);
  return current;
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('hashchange', () => {
    moved = true;
    readLocation();
    for (const fn of Array.from(listeners)) fn();
  });
}

function subscribe(fn: () => void) {
  install();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const SERVER_ROUTE = parseHash('');

/** The current route; re-renders on every hash change. */
export function useRoute(): AppRoute {
  return useSyncExternalStore(subscribe, readLocation, () => SERVER_ROUTE);
}

/** The current route outside React. */
export const currentRoute = (): AppRoute => readLocation();

/**
 * Go to a hash route ('#/files', '/files' or 'files' all work). `replace` swaps the history entry
 * (use it for redirects and filter changes, so Back does not walk through every filter).
 */
export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (typeof location === 'undefined') return;
  const hash = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (hash === location.hash) return;
  if (opts.replace) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
    // replaceState does not fire hashchange: notify by hand.
    readLocation();
    for (const fn of Array.from(listeners)) fn();
  } else {
    location.hash = hash;
  }
}

/**
 * Back if the player has moved inside the app since the page loaded, else to `fallback` (Home) — so a
 * Back button on a screen opened from a shared link never leaves the site.
 */
export function goBack(fallback: string = '#/') {
  if (moved && typeof history !== 'undefined') {
    history.back();
    return;
  }
  navigate(fallback);
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** A hash href, e.g. href.route('state-up') or '#/files'. */
  to: string;
  /** Replace the history entry instead of pushing one. */
  replace?: boolean;
};

/**
 * A plain anchor to a hash route. Ordinary clicks navigate in place; modified clicks (new tab,
 * copy link) keep the browser's behaviour because the href is a real URL fragment.
 */
export function Link({ to, replace, onClick, ...rest }: LinkProps) {
  const hash = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  return createElement('a', {
    ...rest,
    href: hash,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !replace) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(hash, { replace: true });
    },
  });
}
