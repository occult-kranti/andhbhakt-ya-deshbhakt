/** Derive the static pages' tiny first-paint bridge from the same namespace as the app. */
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';

const themeKey = storageNames(STORAGE_NS).theme;
export const publicationThemeSource = `/* Build-derived from the HISAAB storage namespace. Only reads the theme preference. */
(() => {
  try {
    const theme = localStorage.getItem(${JSON.stringify(themeKey)});
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch { /* Blocked storage and system preference use the CSS/device fallback. */ }
})();
`;

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.argv.includes('--check')) throw new Error('The Vite publication plugin emits this asset. Use --check to verify its behavior.');
  for (const pref of ['light', 'dark', 'system', 'invalid', null, 'blocked']) {
    const dataset = {};
    runInNewContext(publicationThemeSource, {
      document: { documentElement: { dataset } },
      localStorage: { getItem(key) {
        assert.equal(key, themeKey);
        if (pref === 'blocked') throw new Error('Storage blocked');
        return pref;
      } },
    });
    assert.deepEqual(dataset, pref === 'light' || pref === 'dark' ? { theme: pref } : {});
  }
  console.log('Publication preference bridge: 6 behavior checks passed.');
}
