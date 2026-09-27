# Completed-game feedback and advertising

Implementation date: 27 September 2026. This follows the owner's current request and supersedes the older home-only advertising placement rule for this branch. Publishing or enabling live ads still requires real publisher configuration. The checked-in build has ads disabled.

## The result comes first

Correct-answer stamps say **WAAH WAAH**. Win, loss and draw results carry a short inline acknowledgement. A loss keeps its accurate outcome and offers “Taali toh banti hai” rather than a false win or pressure to recover coins. The icon nod lasts 650 ms and disappears under reduced motion or Effects Off. Existing result sounds remain controlled by the player's sound preferences; the acknowledgement adds no extra sound.

## Cadence

| Completion | Placement eligibility |
| --- | --- |
| Completed practice file or daily learning run | One placement opportunity per distinct run |
| Completed human duel win | Every second cumulative win |
| Completed human duel loss | Every third cumulative loss |
| Draw | Does not advance either counter |
| Abandoned, cancelled, incomplete match | Does not enter the journal |

Wins and losses count independently until either threshold offers a placement; that opportunity resets **both** tallies. This prevents adjacent breaks after mixed results. A practice completion does not alter either duel counter. The scheduler offers at most one placement for an event, never a queue of backlogged ads.

The win/loss cadence applies to a finished online duel or friend duel with a specific device player's seat and a stable match ID. Shared-device Pass & Play has two human seats but no single owner of the device outcome, so it does not arbitrarily count seat 0 as this player's win or loss. Bot matches do not count.

Completion IDs and counters are saved **before** loading any provider code. Repeated polling, remounting or refreshing a completed result cannot repeat its ad opportunity. Web Locks serialize cross-tab result recording where available. Without Web Locks, localStorage remains best effort across simultaneous tabs. Blocked, corrupt or full storage skips the placement; it never blocks play. The journal fails closed at 20,000 IDs instead of evicting old IDs and accidentally replaying them. These local counts are advertising cadence only; they do not award XP, coins or leaderboard status.

`CompletionAdBreak` is mounted only on terminal results. The result stays visible until the player deliberately chooses the inline **Continue** action; no timer opens an ad. The provider's own ready state then enables a second Continue gesture to request a placement directly. Leaving the result cancels that opportunity; it is not carried into a live question. The player can return to the result from the break at any time. Zero-stake games follow the same gameplay rules and remain available regardless of ad availability or watching.

## Actual provider integration

The adapter uses Google's H5 Ad Placement API with a **next** interstitial placement. Google requires `adBreak()` to follow a direct user action, so a ready break displays **Continue**; that button calls the provider directly. API readiness alone does not request a displayed ad. The provider controls fill, frequency limits and format: a placement is **not a promise of a video**. There is no placeholder video and no rewarded-watch coin payout.

The SDK runs in the same document as the game, following Google's document-structure guidance. An ad-only iframe is deliberately not used. The result is already durable, so ending a SDK-backed break reloads that result document to remove all third-party callbacks, timers and preload activity before the next game. Persistent completion deduplication prevents a reload loop. The adapter ignores callbacks after disposal as an additional guard.

Loading is bounded to four seconds; a ready/shown break is bounded to 90 seconds. No-fill, frequency cap, error, blocked SDK, timeout, offline transition, navigation, consent revocation and user dismissal all return control without payout changes. Native dialog semantics isolate focus and make the underlying game inert while the break is open. Game audio pauses across the provider lifecycle; closing it returns audio control to the next user gesture.

### Configure an approved release

1. Obtain an actual Google AdSense/H5 game approval for the published HTTPS origin and its game. An AdSense display unit alone is not H5 approval. Review the publisher's content/format requirements for this game before activation.
2. Install and test a reviewed CMP with the existing `window.hisaabAdConsent` bridge and actual provider consent signals; a custom accept checkbox is not a substitute. The current gate allows only an adult audience with explicit advertising/storage consent and satisfied regional rules.
3. Set the existing `HISAAB_ADS_ENABLED`, `HISAAB_ADS_SITE_APPROVED`, `HISAAB_ADS_AUTO_ADS_DISABLED`, publisher client, CMP ID and exact HTTPS origin values. Disable account-level Auto ads. Then set `HISAAB_ADS_H5_ENABLED=true` and `HISAAB_ADS_H5_APPROVED=true` only when those statements are true. The home display slot remains a separate optional configuration.
4. In an approved provider test build, set `HISAAB_ADS_H5_TEST=true`. Exercise Continue, no-fill, blocked script, offline, keyboard close, consent withdrawal, silent ads, a long ad, and page reload. Confirm the CMP's real consent signals reach the SDK and the game is not advertising to a protected audience. Remove test mode for public serving.
5. Before using GitHub Pages for an ad-funded release, resolve its hosting terms for commercial/SaaS usage or move to an approved host. Keep `HISAAB_ADS_ORIGIN` as the origin alone (for example `https://owner.github.io`), with the game path in `HISAAB_BASE`. Verify any required `ads.txt` at the origin root through the repository that owns that root. Never place credentials or private keys in these public build-time values.

No publisher account, ad creative, consent platform, live fill or live video has been supplied/verified by this implementation. Tests use provider callbacks as doubles and prove application scheduling/failure handling, not ad-network approval or revenue.

## Integration contract

```tsx
<CompletionAdBreak
  key={`online:${match.id}:${match.selfId}`}
  completionId={`online:${match.id}:${match.selfId}`}
  kind="duel"
  outcome="win" // derive from the finished server match, never an optimistic answer
/>
<OutcomeCelebration key={match.id} outcome="win" />
```

Practice uses `kind="practice"` with a stable run ID. Do not mount it once per answer. Do not mount on a merely disconnected or cancelled match. `OutcomeCelebration` is inline text and an icon; the parent result continues to own its existing sound cue and score announcement.

## Sources reviewed

- Google, [Example implementation](https://developers.google.com/ad-placement/docs/example): direct user-action requirement and actual queue setup.
- Google, [HTML5 game structure](https://developers.google.com/ad-placement/docs/html5-game-structure): game and API share a document.
- Google, [Placement types](https://developers.google.com/ad-placement/docs/placement-types): `next` placement and distinction from reward placements.
- Google, [adBreak](https://developers.google.com/ad-placement/apis/adbreak): completion callback, no-fill and provider frequency-cap statuses.
- Google, [adConfig](https://developers.google.com/ad-placement/apis/adconfig): sound configuration, readiness and preloading.

Targeted automated verification: `node --test tests/hisaab-game-break.test.mjs tests/hisaab-ads.test.mjs tests/hisaab-storage.test.mjs`.
