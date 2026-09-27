/**
 * editions/hisaab/main.tsx — SPA entry of the Andhbhakt ya Deshbhakt edition build (vite.config.hisaab.ts).
 *
 * Applies the stored theme and preloads the two first-paint fonts before anything renders, then mounts
 * the app (app/app.tsx) behind a dynamic import, so a failed chunk shows a plain retry card instead of
 * a blank page — the same rule static/main.tsx follows. The engine's placeholder dev shell stays
 * reachable at #/dev (engine debugging only; never linked).
 */
import { createRoot } from 'react-dom/client';
import aksharLatin from '@fontsource-variable/akshar/files/akshar-latin-wght-normal.woff2?url';
import muktaLatin from '@fontsource/mukta/files/mukta-latin-400-normal.woff2?url';
import { applyStoredTheme } from './app/shell/theme';

applyStoredTheme();

// Bible §4.2: preload only Akshar latin (variable) and Mukta latin 400. Same URLs the CSS resolves to.
for (const href of [aksharLatin, muktaLatin]) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.crossOrigin = 'anonymous';
  link.href = href;
  document.head.appendChild(link);
}

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
const root = createRoot(container);

void (async () => {
  try {
    const { App } = await import('./app/app');
    root.render(<App />);
  } catch {
    root.render(
      <main style={{ padding: '24px 16px', font: '16px/1.5 system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '20px', margin: '0 0 8px' }}>Andhbhakt ya Deshbhakt could not load.</h1>
        <p style={{ margin: '0 0 12px' }}>The connection dropped while the game was loading.</p>
        <button type="button" onClick={() => location.reload()} style={{ minHeight: 44, padding: '0 16px', fontSize: 16 }}>
          Try again
        </button>
      </main>,
    );
  }
})();
