# HISAAB DO: domain launch and optional advertising

> **27 September 2026 — static-release instructions superseded for server play.** Use [SERVER-LAUNCH.md](./SERVER-LAUNCH.md) for the active Supabase server architecture, exact competition rules, required services and verification gates. The static deployment guidance below is retained as the earlier release record; its “no backend required” statements describe that release only. Supabase is now reported **ACTIVE_HEALTHY**. Server publication remains subject to the release evidence recorded separately. Advertising remains off, and the advertising guardrails below continue to apply.

Release scope: `claude/loving-pasteur-s8xwtf`, separate HISAAB edition. Updated 26 September 2026.

For the independent hosted release, exact service requirements, Supabase status and the browser-data migration boundary, see [STANDALONE-LAUNCH.md](./STANDALONE-LAUNCH.md).

## Launch the game

The current Pages workflow builds only the edition and replaces `gh-pages/hisaab/`. It leaves the JHK root in place. Keep that workflow and branch: do not merge this work into `main`, add a root `CNAME`, or change the existing repository's Pages domain. A repository Pages domain applies to its site, not only its `hisaab/` subfolder.

A custom HISAAB domain should point at a **separate static hosting project** whose artifact is the standalone HISAAB build. The existing Pages URL can remain live. This requires the chosen domain and access to its DNS/hosting account. No application backend is required for the current edition; peer-to-peer connections still depend on the players' networks. A domain by itself does not turn local circles into a synced membership service.

Build a dedicated artifact from the release branch:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node --test tests/*.test.mjs
node scripts/hisaab-validate.mjs
HISAAB_BASE=/ HISAAB_OUT=dist-hisaab-domain pnpm build:hisaab
```

Upload only `dist-hisaab-domain/` to a separate static host. Its root must contain `index.html`, `assets/`, `about.html`, `privacy.html`, `contact.html`, the manifest, fonts and downloads. Hash URLs work without a SPA rewrite. Never upload the repository or credential files as the static artifact.

One supported route is a new Cloudflare Pages project (not the existing game Worker): set the build command to `HISAAB_BASE=/ pnpm build:hisaab`, output to `dist-hisaab`, production source branch to `claude/loving-pasteur-s8xwtf`, and Node to 22. Alternatively upload the already built directory using the host's direct-upload flow. Connect the supplied domain in that project's custom-domain settings, then apply the DNS records that host provides. Confirm HTTPS, the home page, a copied `#/q/...` link, friend invite, fonts, downloads and the three publication pages on the actual domain. Check mobile 320/390px and desktop before switching promotion links.

The source code is ready for either `/fact-duel/hisaab/` or `/`. The domain/host choice is an owner input, not an invented deployment. The build does not create DNS records, purchase a domain, configure an account or claim a live custom-domain launch.

## What ships for ads

**Advertising is OFF by default.** There are no fake publisher IDs, live ad tags in HTML, placeholder banners, impression calls or consent acceptance buttons. Importing the ad module performs no network or storage activity. The home page includes a dormant slot after its content; the rest of the product remains ad-free.

| Location | Release behavior | Rationale |
| --- | --- | --- |
| Home after all editorial content | One optional manual display slot, labeled “Advertisements” | A natural reading break, separated from play controls by at least 160px |
| Receipt archive | No ads; future consideration only | The archive can open an active Dobara review without changing its route |
| Questions, daily, routes, taster, live duel, pass-and-play | No ads | Preserve timing and avoid accidental taps |
| Result / receipt, friend lobby, circles, family interaction | No ads | No interruption before or during review and sharing |
| Fixed bars, overlays, interstitials, rewarded ads, automatic refresh | Not implemented | No competition with navigation, score or XP |

The rendered ad area reserves 280px of height, uses a neutral border and plain label, and loads only near the viewport. Ad failure removes the slot. It never looks like a clipping, source receipt or button. No ad impression or click is connected to XP. Ad blockers do not affect gameplay.

An SDK cannot be reliably unloaded by deleting its script tag. After the SDK was requested, navigating away from the bare home route performs a full reload into the requested route. That game document loads no ad runtime. Consent withdrawal also reloads the document; a CMP must retain the withdrawal before notifying subscribers. There are no ads on `#/receipts`, including its local review state.

## Inputs needed to activate monetization

The game can launch without ads. AdSense activation separately needs:

1. The owner's real AdSense publisher account and domain approval. The actual site status must be ready; a build flag does not grant approval.
2. A real manual display ad-unit ID for the home placement. In the AdSense account, turn **Auto ads off**, including automatic optimization of placements. Hash routes cannot safely isolate automatic placements inside this SPA.
3. A selected, configured consent management platform and a reviewed adapter. Use a Google-certified CMP when required; publish the applicable regional messages and vendor disclosures. The current adapter contract is a connection point, **not** a CMP implementation or compliance certification.
4. A defensible audience decision. This integration intentionally denies ads to unknown or minor audiences. Being in a family circle is not proof of adult age. Do not infer adult status from opening the home screen or from a nickname.
5. Real publisher/contact details and a private contact route if the owner wants to receive confidential privacy requests. The current public contact page honestly identifies the public GitHub tracker and absence of a supplied private mailbox.
6. Review of the privacy notice against the selected CMP, actual vendors, target regions and operational data practices. Publish the reviewed notice before activating ads.

No consent granted, no known adult audience, wrong domain, missing slot, missing approval, a loading/broken CMP or an unrecognized route all mean **no ad request**. Non-personalized ads are a product setting, not an exemption from consent/storage requirements. We do not promise AdSense approval, revenue or a date for approval.

## Build configuration

Pass these public configuration values in the build environment (none are secrets). Example names are documented in `release-config.example.env`; its fields are deliberately blank and ads disabled. The Vite config reads the process environment; merely copying that example to a `.env` file does not activate it.

| Variable | Required value for activation |
| --- | --- |
| `HISAAB_ADS_ENABLED` | Exact `true` only after the other work is verified |
| `HISAAB_ADS_SITE_APPROVED` | Exact `true` reflecting the real approved site |
| `HISAAB_ADS_AUTO_ADS_DISABLED` | Exact `true` reflecting the account setting |
| `HISAAB_ADS_ORIGIN` | Exact HTTPS origin, without a trailing slash or path |
| `HISAAB_ADS_CLIENT` | Real `ca-pub-` publisher identifier |
| `HISAAB_ADS_HOME_SLOT` | Real 10-digit manual display unit identifier |
| `HISAAB_ADS_CMP_ID` | Stable identifier of the reviewed CMP adapter/provider |

A syntactically valid publisher ID adds a `google-adsense-account` meta tag for ownership verification even while ads stay off. For a root build (`HISAAB_BASE=/`) it also emits `ads.txt` with that publisher ID. It does not emit an `ads.txt` file for the current subfolder build: `/fact-duel/hisaab/ads.txt` would not be the origin's root file. Confirm `https://YOUR_DOMAIN/ads.txt` is served as text and matches the owner's account. Do not add another game's publisher line without its owner's authorization.

## CMP adapter contract

Only the publisher's reviewed provider integration may set `window.hisaabAdConsent`. Install the CMP using that provider's official current instructions; the ad module does not load one on spec. The object must provide:

```ts
type AdConsentSnapshot = {
  status: 'ready' | 'loading' | 'error';
  providerId: string;              // must equal HISAAB_ADS_CMP_ID
  advertisingAllowed: boolean;    // affirmative advertising permission
  storageAllowed: boolean;        // permission for required storage
  regionalRulesSatisfied: boolean;// adapter validated applicable regional signals
  audience: 'adult' | 'minor' | 'unknown';
};
window.hisaabAdConsent = {
  getSnapshot(): AdConsentSnapshot,
  subscribe(listener: () => void): () => void,
  openPreferences(): void,
};
// Notify the app after the reviewed bridge becomes available:
window.dispatchEvent(new Event('hisaab:ad-consent-ready'));
```

These values must reflect the CMP's real current signals and the site's audience logic. Do not paste an always-true object into a page. `regionalRulesSatisfied` is the adapter's assertion after actual implementation review, not proof supplied by this code. Keep IAB/Google vendor signals available for the AdSense SDK itself. The runtime requests non-personalized ads and requires explicit permission globally, a stricter product rule than many regional minimums. A generic banner or Consent Mode configuration alone is not a substitute for the selected CMP.

Ad privacy choices is shown in the home publication footer once the bridge is available. It invokes `openPreferences`; withdrawal must notify subscribers and be persisted by the CMP before the reload. Listener errors deny new requests. Test accept, decline, reopen, revoke, reload, cross-region policy and unknown/minor audiences with the actual provider before enabling the build flag.

## Implementation and verification

- `editions/hisaab/app/ads/policy.mjs`: pure default-off config and positive allowlist.
- `runtime.mjs`: no script until all gates pass; single manual SDK load, async-race rechecks, unmount cancellation, no retry/refresh, clean-document route and revocation boundary.
- `ad-slot.tsx` / `ads.css`: visible-slot loading, reserved layout, label and publication links.
- `vite.config.hisaab.ts`: public config, optional ownership meta tag and root-only ads.txt.
- `tests/hisaab-ads.test.mjs`: deny states, wrong domain, unknown routes, minor audience, missing/broken CMP, no unauthorized network, one SDK load, cancellation, SDK error, consent and navigation races. Test-only example IDs never enter release config.

Run `node --test tests/hisaab-ads.test.mjs` and the release suite. In browser QA with the default build, inspect network requests across home, gameplay and circles and verify none reaches the AdSense vendor. When account integration is later completed, repeat with an approved staging/test setup and the real CMP, confirm no pre-consent ad request, and inspect placement separation on both screen sizes. Default-off unit tests do not certify a future CMP integration.

## Official sources reviewed 26 September 2026

- Google, [AdSense content ads on game-play pages](https://support.google.com/adsense/answer/2768340): avoid confusing game controls with ads; recommends 150px separation or removing ads on play pages. This implementation removes them from play pages.
- Google, [Ad placement policies](https://support.google.com/adsense/answer/1346295) and [best placement practices](https://support.google.com/adsense/answer/1282097): avoid accidental clicks and misleading content; use an allowed advertising label.
- Google, [Auto ads settings](https://support.google.com/adsense/answer/9305577): account settings control automatic placements; keep them off here.
- Google, [Connect a site to AdSense](https://support.google.com/adsense/answer/7584263): a site needs approval before showing ads; meta tags are an available verification method.
- Google, [Ads.txt guide](https://support.google.com/adsense/answer/12171612): real publisher identifier and root URL; the file is highly recommended rather than a claim that approval is automatic.
- Google, [CMP requirements](https://support.google.com/adsense/answer/13554116) and [consent management](https://support.google.com/adsense/answer/7670013): certified CMP requirement for personalized ads in EEA, UK and Switzerland, and applicable disclosures/storage consent. Product gating here remains stricter and uses a reviewed CMP for any advertising.
- Google, [Privacy & Messaging JavaScript API](https://developers.google.com/funding-choices/fc-api-docs): official provider integration guidance to consult when choosing Google's CMP.
- GitHub, [Custom domains and Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages) and [managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site): domains attach to sites/repositories, not a path within a site.
- Cloudflare, [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/): a separate output artifact can be hosted and connected to its own domain.
