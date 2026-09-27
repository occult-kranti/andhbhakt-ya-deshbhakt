# Editions and competition titles

The approved Day and Night palettes are unchanged. **Classic edition** restores the earlier lamp-lit, brown-black file-room palette from `ea25dbea`, including its violet ink and brighter stamps. It is a dark colour scheme for native controls. Settings and the in-game settings dialog offer Day, Night, Classic, Rotate editions, and Match device.

**Rotate editions** cycles Day → Night → Classic by UTC date. The game resolves that choice once when its module loads and holds it for the visit. Neither midnight nor an operating-system appearance change repaints a live round. Manually selecting another edition still applies immediately. Public About, Privacy and Contact pages use the same preference and daily calculation. Match device uses the existing Day/Night system fallback. No new storage key is needed.

The Classic palette passes the same 99 text and control contrast comparisons used in the previous brand review; see `review/classic-contrast.json`. Both dark palettes keep stamps legible, and a forced-light certificate still uses the light stamp treatment.

## The ninth title

**Desh Bhakt / देश भक्त** is a temporary competition honour at display position 9. Certified Anti-National is display position 10. The nine existing XP bands, level thresholds, promotion history and earned progress remain unchanged. The normal profile ladder contains no Desh Bhakt row, locked badge or teaser.

Only a current online server qualification may be passed to `activeCompetitionTitle`. Its envelope is:

```js
{
  title: 'desh-bhakt',
  source: 'leaderboard', // or 'tournament'
  competitionId: 'server-owned-competition-id',
  rank: 1,              // integer 1–10, computed by the server
  awardedAt: 0,         // Unix milliseconds
  expiresAt: 0          // Unix milliseconds; exclusive boundary
}
```

The server owns the ranking, match eligibility, competition window, grant/revocation and mode-dependent duration. The helper only validates presentation fields and hides expired, future, incomplete or out-of-range qualifications. It is not an authentication or anti-cheat boundary. Online UI must use the current API grant, display the source and end time, and discard it when refreshed qualification is absent; local XP and browser storage cannot mint an honour. The title disappears exactly at expiry. It does not erase or replace the player's permanent XP label.

## Verification

- `node --test tests/hisaab-theme-titles.test.mjs tests/hisaab-edition.test.mjs` checks boundaries, malformed grants, unchanged XP banding, and the three-day rotation.
- `node scripts/hisaab-publication-theme.mjs --check` covers all five preferences, invalid values, unavailable storage and no preference.
- `node scripts/hisaab-theme-check.mjs <running-app-base-url> <output-directory>` checks the actual settings at 390px and 1440px, all five preferences, native colour schemes, public-page parity, overflow and rotation stability across midnight.
