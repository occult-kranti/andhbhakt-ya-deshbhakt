/** Derive the static pages' tiny first-paint bridge from the same namespace as the app. */
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { storageNames } from '../lib/storage-names.mjs';
import { STORAGE_NS } from '../editions/hisaab/storage-ns.mjs';
import { rotatingEdition } from '../editions/hisaab/theme/preference.mjs';

const themeKey = storageNames(STORAGE_NS).theme;
export const publicationThemeSource = `/* Build-derived from the HISAAB storage namespace. Only reads the theme preference. */
(() => {
  const rotatingEdition = ${rotatingEdition.toString()};
  try {
    const theme = localStorage.getItem(${JSON.stringify(themeKey)});
    if (theme === 'light' || theme === 'dark' || theme === 'classic' || theme === 'rotate') {
      document.documentElement.dataset.theme = theme === 'rotate' ? rotatingEdition() : theme;
      document.documentElement.dataset.themePref = theme;
    }
  } catch { /* Blocked storage and system preference use the CSS/device fallback. */ }
})();
`;

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.argv.includes('--check')) throw new Error('The Vite publication plugin emits this asset. Use --check to verify its behavior.');
  const at = Date.UTC(2026, 8, 27);
  for (const pref of ['light', 'dark', 'classic', 'rotate', 'system', 'invalid', null, 'blocked']) {
    const dataset = {};
    runInNewContext(publicationThemeSource, {
      document: { documentElement: { dataset } },
      Date: { now: () => at },
      localStorage: { getItem(key) {
        assert.equal(key, themeKey);
        if (pref === 'blocked') throw new Error('Storage blocked');
        return pref;
      } },
    });
    assert.deepEqual(dataset, ['light', 'dark', 'classic', 'rotate'].includes(pref)
      ? { theme: pref === 'rotate' ? rotatingEdition(at) : pref, themePref: pref } : {});
  }
  console.log('Publication preference bridge: 8 behavior checks passed.');
}
