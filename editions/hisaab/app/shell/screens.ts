/**
 * shell/screens.ts — every screen, lazily imported from editions/hisaab/app/screens/<name>/index.tsx
 * (default export, props: ScreenProps). Each lane replaces its own index.tsx; nothing here changes.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ScreenName, ScreenProps } from '../router';

type Screen = LazyExoticComponent<ComponentType<ScreenProps>>;

export const SCREENS: Readonly<Record<Exclude<ScreenName, 'dev' | 'not-found'>, Screen>> = Object.freeze({
  home: lazy(() => import('../screens/home')),
  start: lazy(() => import('../screens/start')),
  files: lazy(() => import('../screens/files')),
  money: lazy(() => import('../screens/money')),
  ledger: lazy(() => import('../screens/ledger')),
  route: lazy(() => import('../screens/route')),
  aaj: lazy(() => import('../screens/aaj')),
  taster: lazy(() => import('../screens/taster')),
  duel: lazy(() => import('../screens/duel')),
  circles: lazy(() => import('../screens/circles')),
  pass: lazy(() => import('../screens/pass')),
  room: lazy(() => import('../screens/room')),
  receipts: lazy(() => import('../screens/receipts')),
  me: lazy(() => import('../screens/me')),
  settings: lazy(() => import('../screens/settings')),
  rules: lazy(() => import('../screens/rules')),
});

/**
 * Engine debugging (#/dev), the component gallery (#/dev/ui) and the set-piece lab (#/dev/three).
 * Never linked from the UI.
 */
export const DEV_SCREENS: Readonly<Record<'engine' | 'ui' | 'three', Screen>> = Object.freeze({
  engine: lazy(() => import('../dev-shell').then((m) => ({ default: m.DevShell as ComponentType<ScreenProps> }))),
  ui: lazy(() => import('../ui/gallery')),
  three: lazy(() => import('../three/lab') as Promise<{ default: ComponentType<ScreenProps> }>),
});

/** Default document titles (a screen may refine it with useScreenTitle). */
export const SCREEN_TITLES: Readonly<Record<ScreenName, string>> = Object.freeze({
  home: 'Home',
  start: 'Show us the accounts',
  files: 'Files',
  money: 'The money trail',
  ledger: 'Paisa Kahan Gaya?',
  route: 'File',
  aaj: 'Aaj Ka Hisaab',
  taster: 'One question',
  duel: 'Muqabla',
  circles: 'Friends & family circles',
  pass: 'Pass & Play',
  room: 'Duel',
  receipts: 'Receipts',
  me: 'Me',
  settings: 'Settings',
  rules: 'Rules & Sources',
  dev: 'Dev',
  'not-found': 'File missing',
});
