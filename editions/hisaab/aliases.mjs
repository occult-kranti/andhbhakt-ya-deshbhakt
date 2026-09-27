/**
 * editions/hisaab/aliases.mjs — the whole difference between the JHK build and this edition's build,
 * as one table. Each entry swaps a shared module (by its resolved file) for the edition's twin.
 *
 * vite.config.hisaab.ts turns it into a resolveId plugin keyed by ABSOLUTE path, so the swap catches
 * every import of the module however it is written — `@/lib/content.mjs`, `../content.mjs` inside
 * lib/, `./bank.mjs` inside lib/server/. editions/hisaab/node-aliases.mjs applies the same table as a
 * node module hook, so tests can load the edition's module graph (tests/hisaab-*.test.mjs).
 *
 * A twin may import the module it replaces (the profile-sync twin re-exports the pure half of the
 * original): imports FROM the twin are never redirected.
 *
 * Paths are repo-relative. Keep `why` short; docs/hisaab/ENGINE.md explains each entry.
 */
export const EDITION_ALIASES = Object.freeze(
  [
    // Same three swaps as the server-free JHK build (vite.config.static.ts).
    { from: 'lib/duel-client.ts', to: 'lib/duel-client-static.ts', why: 'duel service in-process, no /api/duel' },
    { from: 'lib/wallet-client.ts', to: 'lib/wallet-client-static.ts', why: 'device wallet only, no /api/wallet' },
    { from: 'lib/presence-client.ts', to: 'lib/presence-client-static.ts', why: 'no live counts without a server' },
    // The edition's own.
    { from: 'lib/edition-rules.mjs', to: 'editions/hisaab/engine/scoring.mjs', why: 'stopwatch XP and 30-second friend/bot rounds' },
    { from: 'lib/profile-sync.ts', to: 'editions/hisaab/engine/profile-sync-static.ts', why: 'no /api/auth or /api/profile on Pages' },
    { from: 'lib/server/bank.mjs', to: 'editions/hisaab/server/bank.mjs', why: 'the civics bank' },
    { from: 'lib/content.mjs', to: 'editions/hisaab/engine/content.mjs', why: "domain 'civics'; TOPIC_DOMAINS = the 13 sectors" },
    { from: 'lib/expedition-routes.mjs', to: 'editions/hisaab/engine/expedition-routes.mjs', why: 'routes derived from the bank' },
    { from: 'lib/events-data.mjs', to: 'editions/hisaab/engine/events-data.mjs', why: 'no sports calendar' },
    { from: 'lib/storage-ns.mjs', to: 'editions/hisaab/storage-ns.mjs', why: 'hisaab-* / hd-* storage names' },
  ].map((alias) => Object.freeze(alias)),
);
