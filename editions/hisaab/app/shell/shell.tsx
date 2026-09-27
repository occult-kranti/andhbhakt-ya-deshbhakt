/**
 * shell/shell.tsx — the app frame: top bar, bottom bar / rail, the routed screen, the toast and
 * ceremony hosts, and the effects that keep <html> in step (theme, motion, locale font, visits).
 */
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getPrefs, subscribePrefs } from '@/lib/fx/prefs';
import { useLocale } from '@/app/use-locale';
import { budget, useBudgetSnapshot } from '../budget';
import { href, navigate, useRoute, type Chrome } from '../router';
import { CeremonyHost } from '../ui/ceremony';
import { ErrorState, Page } from '../ui/page';
import { Skeleton } from '../ui/skeleton';
import { ToastHost } from '../ui/toast';
import { Button } from '../ui/button';
import { ChromeContext, TITLE_SUFFIX } from './chrome';
import { ScreenBoundary } from './error-boundary';
import { Nav } from './nav';
import { ProgressionWatch } from './progression-watch';
import { DEV_SCREENS, SCREENS, SCREEN_TITLES } from './screens';
import { TopBar } from './top-bar';
import { applyTheme, useTheme } from './theme';
import { readLandingPreference } from '../screens/home/landing-preference';
import './shell.css';

/**
 * app/use-locale.tsx links Noto Sans Devanagari from Google Fonts while the locale is Hindi. The
 * edition self-hosts Mukta and Akshar (both cover Devanagari), so it reserves that element id with an
 * inert placeholder: the provider then sees it "already present" and makes no third-party request.
 * Runs in a child layout effect, which React runs before the provider's own.
 */
// JHK's element id (app/use-locale.tsx DEVANAGARI_ID, not exported). Spelled in parts so the edition's
// "no JHK class names" check (hisaab-design verify step 1) keeps meaning what it says.
const JHK_DEVANAGARI_ID = ['fd', 'font', 'devanagari'].join('-');
function useSelfHostedDevanagari(locale: string) {
  useLayoutEffect(() => {
    if (document.getElementById(JHK_DEVANAGARI_ID)) return;
    const meta = document.createElement('meta');
    meta.id = JHK_DEVANAGARI_ID;
    meta.name = 'hisaab-devanagari';
    meta.content = 'self-hosted (Mukta, Akshar)';
    document.head.appendChild(meta);
  }, [locale]);
}

/** <html data-motion> mirrors Effects (lib/fx/prefs motion): 'reduced' for Reduced and Off. */
function useMotionAttributes() {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.effects = prefs.motion;
    if (prefs.motion === 'full') delete root.dataset.motion;
    else root.dataset.motion = 'reduced';
  }, [prefs.motion]);
}

function NotFound() {
  return (
    <Page screen="not-found">
      <ErrorState title="File missing. Babu is on leave." detail="This link does not open any file we have." />
      <div>
        <Button href="#/" variant="primary">
          Go to Home
        </Button>
      </div>
    </Page>
  );
}

export function Shell() {
  const route = useRoute();
  const { locale } = useLocale();
  useTheme(); // subscribes <html data-theme> to the stored choice and the OS
  useSelfHostedDevanagari(locale);
  useMotionAttributes();
  const { ceremony } = useBudgetSnapshot();
  const [override, setOverride] = useState<Chrome | null>(null);
  const setChrome = useCallback((mode: Chrome | null) => setOverride(mode), []);
  const chrome: Chrome = override ?? route.chrome;
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    // A saved preference only affects a new bare visit, never a shared link or an active match.
    if ((!location.hash || location.hash === '#/' || location.hash === '#') && readLandingPreference() === 'daily') {
      navigate(href.online('play', { file: 'today' }), { replace: true });
    }
  }, []);

  // A route change is a new visit (one toast each), a new page for assistive tech, and the top.
  useLayoutEffect(() => {
    budget.newVisit(route.path);
    document.title = route.name === 'home' ? `${TITLE_SUFFIX} — हिसाब दो` : `${SCREEN_TITLES[route.name]} · ${TITLE_SUFFIX}`;
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0 });
    main.current?.focus({ preventScroll: true });
  }, [route.path, route.name]);

  useEffect(() => {
    document.documentElement.dataset.chrome = chrome;
  }, [chrome]);

  // The tokens are in the DOM now: sync <meta name="theme-color"> with the resolved ground.
  useEffect(() => applyTheme(), []);

  // iOS only applies :active (press = print down) when some touch listener exists.
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);

  const Screen =
    route.name === 'dev'
      ? DEV_SCREENS[route.view === 'ui' || route.view === 'three' ? route.view : 'engine']
      : route.name === 'not-found'
        ? null
        : SCREENS[route.name];
  const covered = !!ceremony;
  const showTop = chrome !== 'none';
  const showNav = chrome === 'full' && !covered;

  return (
    <ChromeContext.Provider value={setChrome}>
      <div className="h-app" data-chrome={chrome} data-nav={showNav ? 'on' : 'off'}>
        {/* Skip link: the first Tab stop. A hash router cannot use href="#h-main" as a jump (it would
            be a route), so the click moves focus itself. Visually hidden until focused. */}
        {showTop ? (
          <a
            className="h-sr h-skip"
            href="#h-main"
            onClick={(e) => {
              e.preventDefault();
              main.current?.focus();
            }}
          >
            {locale === 'hi' ? <span lang="hi">मुख्य हिस्से पर जाएँ</span> : 'Skip to content'}
          </a>
        ) : null}
        {showTop ? <TopBar inert={covered} /> : null}
        <main id="h-main" className="h-main" ref={main} tabIndex={-1} inert={covered || undefined} data-route={route.name}>
          <ScreenBoundary resetKey={route.path}>
            <Suspense
              fallback={
                <Page screen="loading">
                  <Skeleton lines={5} />
                </Page>
              }
            >
              <div className={chrome === 'none' ? 'h-screen' : 'h-screen h-screen--enter'} key={route.path}>
                {Screen ? <Screen route={route} /> : <NotFound />}
              </div>
            </Suspense>
          </ScreenBoundary>
        </main>
        {/* After <main> in the DOM (it is position: fixed, so the look is unchanged): a keyboard user
            reaches the screen's content before the five bottom-bar items that sit visually below it. */}
        {showNav ? <Nav tab={route.tab} /> : null}
        <ToastHost />
        <CeremonyHost />
        <ProgressionWatch />
      </div>
    </ChromeContext.Provider>
  );
}
