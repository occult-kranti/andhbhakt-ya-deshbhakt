/**
 * vite.config.hisaab.ts — the HISAAB DO edition build (`pnpm build:hisaab` → `dist-hisaab/`).
 *
 * A second, server-free edition of the JHK engine with the civics bank and its own UI. It reuses the
 * engine (duel service + practice bot + verdict rules, progression, journal/vault, expeditions)
 * unchanged: every difference from JHK is one row of `editions/hisaab/aliases.mjs`, applied here by a
 * resolveId plugin keyed by the RESOLVED ABSOLUTE PATH of the shared module. That catches every way a
 * module is imported — `@/lib/content.mjs` from a screen, `../content.mjs` inside lib/, `./bank.mjs`
 * inside lib/server/ — which a specifier-pattern alias (as in vite.config.static.ts) cannot.
 *
 * The same table is applied in node by `editions/hisaab/node-aliases.mjs`, so tests run the edition's
 * module graph too. JHK's own builds never see any of it.
 *
 * Root and entry: `editions/hisaab/index.html` → `editions/hisaab/main.tsx`; public dir
 * `editions/hisaab/public/`. `base` comes from HISAAB_BASE (default `/fact-duel/hisaab/`, the GitHub
 * Pages path next to JHK); `HISAAB_BASE=/ pnpm build:hisaab` builds for a site root.
 *
 *   pnpm dev:hisaab       dev server
 *   pnpm build:hisaab     production build into dist-hisaab/
 *   pnpm preview:hisaab   serve dist-hisaab/ at the base path
 *
 * `HISAAB_OUT=<dir> pnpm build:hisaab` writes the build somewhere else (relative to the repo root, or
 * absolute), so parallel agents and CI jobs can build without emptying each other's dist-hisaab/.
 * `preview:hisaab` reads the same variable, so `HISAAB_OUT=<dir> pnpm preview:hisaab` serves that build.
 */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { EDITION_ALIASES } from './editions/hisaab/aliases.mjs';
import { adConfigFromEnv, adsTxt } from './editions/hisaab/app/ads/policy.mjs';
import { publicationThemeSource } from './scripts/hisaab-publication-theme.mjs';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const editionRoot = path.join(repoRoot, 'editions/hisaab');
const rawBase = process.env.HISAAB_BASE ?? '/andhbhakt-ya-deshbhakt/';
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
const advertising = adConfigFromEnv(process.env);
/** Where the build goes: HISAAB_OUT (repo-relative or absolute), else dist-hisaab/. */
const outDir = process.env.HISAAB_OUT ? path.resolve(repoRoot, process.env.HISAAB_OUT) : path.join(repoRoot, 'dist-hisaab');

/** Swap each shared module for the edition's twin, by resolved file. See editions/hisaab/aliases.mjs. */
function editionAliases(): Plugin {
  const table = new Map(
    EDITION_ALIASES.map((alias) => [path.join(repoRoot, alias.from), path.join(repoRoot, alias.to)]),
  );
  const file = (id: string) => id.split('?')[0];
  return {
    name: 'hisaab-edition-aliases',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || resolved.external) return null;
      const target = table.get(file(resolved.id));
      // A twin may import the module it stands in for (the profile-sync twin re-exports its pure half).
      if (!target || file(importer) === target) return null;
      return target;
    },
  };
}

/** Account verification makes no ad requests; ads.txt belongs only at a dedicated site's root. */
function publicationAds(): Plugin {
  return {
    name: 'hisaab-publication-ads',
    transformIndexHtml() {
      if (!adsTxt(advertising)) return [];
      return [{ tag: 'meta', attrs: { name: 'google-adsense-account', content: advertising.client }, injectTo: 'head' }];
    },
    generateBundle() {
      const text = adsTxt(advertising);
      if (text && base === '/') this.emitFile({ type: 'asset', fileName: 'ads.txt', source: text });
    },
  };
}

/** Static publication pages use the exact same palette as the app, including OS fallbacks. */
function publicationTheme(): Plugin {
  const assets = {
    'publication-tokens.css': { type: 'text/css', source: () => readFileSync(path.join(editionRoot, 'theme/tokens.css'), 'utf8') },
    'publication-theme.js': { type: 'text/javascript', source: () => publicationThemeSource },
  };
  return {
    name: 'hisaab-publication-theme',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const entry = Object.entries(assets).find(([name]) => pathname === `/${name}` || pathname === `${base}${name}`);
        if (!entry) return next();
        const asset = entry[1];
        res.setHeader('Content-Type', `${asset.type}; charset=utf-8`);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(req.method === 'HEAD' ? undefined : asset.source());
      });
    },
    generateBundle() {
      for (const [fileName, asset] of Object.entries(assets))
        this.emitFile({ type: 'asset', fileName, source: asset.source() });
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: editionRoot,
  base,
  publicDir: path.join(editionRoot, 'public'),
  envDir: repoRoot,
  css: { postcss: repoRoot },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    __HISAAB_BASE__: JSON.stringify(base),
    __HISAAB_ADS__: JSON.stringify(advertising),
  },
  resolve: {
    alias: [
      { find: /^next\/dynamic$/, replacement: path.join(repoRoot, 'static/next-dynamic-shim.tsx') },
      { find: /^@\//, replacement: `${repoRoot}/` },
    ],
  },
  plugins: [editionAliases(), react(), publicationAds(), publicationTheme()],
  server: { fs: { allow: [repoRoot] } },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
}));
