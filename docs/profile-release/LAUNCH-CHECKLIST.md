# AYD + Jaanta Hai Kya: owner launch checklist

Reviewed 27 September 2026. Start with a small, ad-free beta. Check an item only after the named evidence exists. This checklist separates implemented software from owner decisions; it is not a legal opinion or proof of regulatory or ad-network approval.

## Your launch order — ten actions

- [ ] Supply the operator name and a working private privacy/grievance contact.
- [ ] Confirm the self-attested 18+ beta scope and obtain the jurisdiction/content review below.
- [ ] Approve the profile notice, retention and deletion/support process.
- [ ] Verify the final deployed profiles, private fields and two-device duel flows.
- [ ] Confirm backups, monitoring, abuse controls and a small ad-free pilot.
- [ ] Choose the commercial host before monetising; resolve GitHub Pages' business-use limits.
- [ ] If wanted, buy one domain, verify ownership, and connect two subdomains using section 9.
- [ ] Obtain actual publisher/site/H5 approval; both games' ads remain disabled meanwhile.
- [ ] Configure/test consent, ad dismissal, no-fill and failure behavior before enabling ads.
- [ ] Expand against measured capacity; add verified sign-in only if you want the separate section 10 work.

## 1. What you already have

| Item | Current evidence | Still needed |
| --- | --- | --- |
| Two public frontends | Repository READMEs identify [AYD](https://occult-kranti.github.io/andhbhakt-ya-deshbhakt/) and [JHK](https://occult-kranti.github.io/fact-duel/) on GitHub Pages | Compare each live `release.json` with the release commit after deployment |
| Human duel backend | Existing Supabase project `wvupsqfevlrmhqfjreyx`, `ap-south-1`; separate `hisaab-game` / `jhk-game` functions and private schemas | Confirm successful deployment and monitoring for the final profile release |
| Free game economy | Optional coin stakes, zero-stake play, no purchases, deposits, cash prizes or redemption; server settlement and expiry jobs documented | Keep these boundaries in code, rules, promotions and future partnerships |
| Profiles | Candidate profile onboarding/storage is implemented for both games, with self-attested 18+ beta entry and local learning records | Final deployed storage/privacy verification remains required; an entered email is not verified ownership, OAuth sign-in or account recovery |
| Advertising | Both games have candidate scheduling/H5 adapters and optional break UI; ads remain disabled | Final integration verification, real provider approval, consent integration and commercial-hosting decision |
| Custom domains | No domain is required for the existing beta URLs | Buy/configure only when you choose a name; nothing has been purchased by this work |

Implementation evidence: [beta operations](../beta-release/OPERATIONS.md), [AYD README](../../README.md), [game-break integration](../hisaab/GAME-BREAKS.md), and this release's [panel record](./PANEL.md). Older static-only launch notes are historical and do not describe the current backend.

## 2. Your first owner actions

- [ ] **Write down the operator.** Supply the real individual or entity name, country/state of operation, intended audience countries and minimum age. Incorporation is a business decision to review with your adviser; this checklist does not assume a company exists or that one is universally mandatory.
- [ ] **Create a monitored private contact.** Choose an email address or secure request form for privacy, safety and grievance requests. Test receipt and reply. Publish the operator/contact on both sites, assign a response owner, and retain a private complaint record. A public GitHub issue is suitable for public corrections, not private identity or deletion evidence.
- [ ] **Apply the chosen audience scope.** This release adopts a self-attested 18+ beta. Make invitations and content consistent with that scope and decide how underage disclosures/reports are handled. The declaration is not verified age; a nickname or email provides no substitute.
- [ ] **Have counsel review the actual launch scope.** Provide both URLs, the US operating state, intended Indian states/other countries, screenshots, coin rules, ad plan, data inventory and satire assets. Ask for the applicable gaming classification/notifications, privacy/children's requirements, grievance duties, publicity/defamation/copyright review, and any entity/tax obligations. Record the outcome and any geographic or product restrictions. Do this before broad promotion; repeat when introducing valuable prizes, paid coins, entry fees, trading or cash-out.

## 3. Keep the game economy within the reviewed scope

- [ ] Keep coins **free, nonpurchasable, nonredeemable and without real-world value**. Keep zero-stake play available at zero balance. Do not sell replenishment, bundle coins with purchases, permit paid transfers/secondary markets, promise prizes or advertise tax savings as real money.
- [ ] Publish the stake reservation, win/draw/refund/forfeit rules and reward caps in plain language. Keep gameplay rewards separate from any future ad reward. Obtain a fresh review before introducing “watch ads to replenish wager coins”; the business model matters, not merely the word “free.”
- [ ] **India:** check the current official notifications for the game's category and whether determination or registration is required. Do not label this casual quiz a registered e-sport or claim government approval.

**Why these checks:** India's 2025 Act covers money games irrespective of skill versus chance. Its definitions distinguish social games from staking money/other stakes for monetary enrichment; “other stakes” includes money-purchased or money-convertible virtual items. The described free/no-prize design supports a social-game interpretation, but this is an inference requiring review of the actual mechanics. [Act, sections 2, 5–8 and 18](https://www.meity.gov.in/static/uploads/2025/10/8a7f103cefc68ed8aaa2ebc9a2ed7c13.pdf).

The government's final-rules summary says the **2026 Rules took effect 1 May 2026**. Registration applies to e-sports and notified social-game categories, rather than automatically to every social game. It describes revenue-model/reward monetisation factors, risk-appropriate user-safety features, and a functional grievance mechanism for every social-game/e-sport provider. Check current notifications and orders, not just the former draft. [Official MeitY/PIB explanation](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2254606&lang=1&reg=3); [Act/rules/notification hub](https://www.meity.gov.in/documents/act-and-policies/promotion-and-regulation-of-online-gaming-act-2025-and-its-corrigenda-kTMxQjMtQWa).

**US:** do not claim nationwide gambling clearance from “no cash-out.” State tests vary; Washington's statutory “thing of value” includes certain extensions of entertainment or a privilege of playing. Keep unlimited zero-stake access and obtain a state-specific assessment before prizes or monetisation changes. [Washington RCW 9.46.0285](https://app.leg.wa.gov/rcw/default.aspx?cite=9.46.0285); [chapter definitions](https://app.leg.wa.gov/rcw/default.aspx?cite=9.46&full=true).

## 4. Finish profile privacy and support

- [ ] **Approve the data inventory and notice.** List name/nickname, entered email, age declaration if used, device credential, online results/coins/XP, local progress/photo, consent records, abuse-limiting identifiers and operational logs. State each purpose, what becomes public, actual providers, retention and deletion routes. Disclose the Supabase project region without promising every provider/log stays exclusively in India.
- [ ] **Describe email honestly.** If collected without verification, label it unverified contact data. Do not link profiles, disclose records or restore an account just because someone types the same email. Do not publish it on leaderboards, certificates, URLs or routine logs. Do not infer marketing permission from registration or gameplay.
- [ ] **Test rights handling.** Demonstrate correcting profile fields and requesting/deleting relevant server data with an appropriate identity check. Explain separately how to clear device progress/photo. A 30-day credential expiry is not automatic deletion of historical server records. Choose and implement a retention schedule; do not promise one that has not been implemented.
- [ ] **Review children and regional privacy duties.** COPPA can apply to child-directed services and services with actual knowledge of under-13 users; simply stating “adults only” does not override actual design/audience facts. Use the amended rule, whose general compliance date was 22 April 2026. Evaluate US state privacy applicability and any opt-out/consent duties for actual traffic. [FTC guide](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [amended rule](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule), [California AG guidance](https://oag.ca.gov/privacy/ccpa).
- [ ] **Plan for India's phased DPDP implementation.** The final 2025 Rules have staggered commencement: some on publication, rule 4 after one year, and rules 3, 5–16, 22–23 after eighteen months. Map the Act's commencement notifications, final rules/corrigenda, children's provisions and any other currently applicable law to the launch date with counsel. Do not describe all DPDP obligations as already fully operational in September 2026, or the transition as permission to collect indiscriminately. [Final rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), [official rules hub](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa).

## 5. Review AYD satire and both question banks

- [ ] Clearly identify caricatures, titles and certificates as satire, with no politician/party/government endorsement. Avoid official seals and a presentation that suggests an official certificate. Review the combination of picture, caption and share text, not only the disclaimer.
- [ ] Check each factual allegation against a dated source; distinguish opinion/satire from verifiable accusations. Add a correction route and a takedown/escalation owner. Review defamation, local publicity/personality rights and political/election rules for the actual distribution and any paid promotion.
- [ ] Keep rights/provenance records for drawings, reference photographs, fonts, sounds, logos and quoted question material. Publicly available does not automatically mean reusable. Original caricature does not automatically clear a copied photograph or imply endorsement.

US public-figure parody has important First Amendment protection, but it is not a worldwide immunity. See [Congress Constitution Annotated: privacy torts/parody](https://constitution.congress.gov/browse/essay/amdt1-7-5-10/ALDE_00013811/). India's defamation provision includes specific good-faith exceptions for public conduct; “satire” is not a blanket statutory exemption. See [BNS section 356](https://www.indiacode.nic.in/show-data?actid=AC_CEN_5_23_00048_2023-45_1719292564123&orderno=356). Copyright fair use is case-specific: [US Copyright Office](https://www.copyright.gov/help/faq/faq-fairuse.html).

## 6. Turn on ads only as a separate release

- [ ] **Resolve hosting first.** GitHub Pages says it cannot be used as free hosting to run an online business/commercial SaaS. Confirm the proposed ad-funded use with GitHub or move the frontend to a host whose terms permit it before commercial rollout. Buying a domain does not change Pages' terms. [Official limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- [ ] **Obtain provider approval.** Open the owner's real publisher account; complete required identity, payment/tax and site checks; obtain H5 program access and approved identifiers. Document the approved game/site and permitted placements. Approval, fill, revenue and video format are not guaranteed. [H5 getting started](https://support.google.com/adsense/answer/9959170), [H5 program](https://adsense.google.com/start/h5-games-ads/).
- [ ] **Review the exact coin/satire content with the provider.** Google's gambling inventory rules concern money/items of value paid or wagered for real money/prizes. Provider classification remains separate from legal classification. Keep gambling/betting ad categories blocked; do not advertise prohibited Indian money games. [Publisher gambling restriction](https://support.google.com/publisherpolicies/answer/10437963?hl=en), [sensitive categories](https://support.google.com/adsense/answer/164131?hl=en-GB).
- [ ] **Configure a real consent platform and adapter.** Verify appropriate regional consent/opt-out messages, vendor disclosure and withdrawal. Use a Google-certified TCF CMP where Google's rules require one for personalised EEA/UK/Swiss ads. Nonpersonalised ads are not a blanket exemption from privacy/storage obligations. Keep the app's stricter adult-and-consent gate until a reviewed change. [Google requirements](https://support.google.com/adsense/answer/13554116?hl=en).
- [ ] **Use natural breaks, not compulsory video completion.** The existing practice/two-win/three-loss counters create opportunities, not a promise an ad must display. Preserve provider close/skip controls and immediate progress on no-fill, blocked scripts, failure or consent refusal. Do not interrupt timed questions, hide results, force ad clicks or modify provider controls. Display versus video is provider-controlled. [H5 placement types](https://developers.google.com/ad-placement/docs/placement-types), [AdSense policies](https://support.google.com/adsense/answer/48182).
- [ ] **If rewarded ads are added later:** provide the required clear offer and opt-in/decline route; normal use must continue after decline. No cash or transferable real-world rewards. Do not silently reclassify a forced interstitial as “rewarded.” [Rewarded-ad policy](https://support.google.com/adsense/answer/9121589?hl=en).
- [ ] Test with provider test inventory: consent denied/withdrawn, unknown/minor audience, no-fill, script failure, offline, mobile back/close and keyboard use. Verify no accidental clicks and no duplicate opportunities. Remove test mode only after approval. Configure any required `ads.txt` at the correct origin root; a file inside a project subfolder is not the root file. Do not click live ads to test them.

## 7. Reliability, abuse and a small beta

- [ ] Confirm Supabase billing plan, shared-project usage and spending alerts. Check backup availability and perform a restore exercise in an isolated environment; never restore over unrelated shared-project apps for a test. Free projects have no included automatic backups and may pause after inactivity. [Pricing](https://supabase.com/pricing), [backup guide](https://supabase.com/docs/guides/platform/backups).
- [ ] Assign monitoring for function failures, database capacity, abandoned rooms, expiry-job failures and unusual coin/reward activity. Keep service credentials server-side; scope access and review secret rotation and incident response.
- [ ] Test email/name injection and oversized inputs; keep one player's private fields inaccessible to another. Exercise rate limits, repeat registration, room spam and reward farming. Publish reporting rules and a practical moderation process. Unverified profiles do not prevent collusion or multi-accounting.
- [ ] Invite a bounded pilot group across intended Indian/US networks and inexpensive phones. Record invite success, wait times, errors, abandonment and timing complaints; agree numeric stop/rollback criteria before expansion. No players available must remain an honest state, never a hidden bot replacement.
- [ ] Run two real devices through onboarding, refresh, profile editing, zero-stake and staked matches, tie, timeout, disconnect, repeat settlement and cancellation. Verify live receipts, public/private field separation, mobile accessibility and actual release commits. Keep evidence and an operator rollback procedure.

## 8. What costs money?

| Item | Required now? | Cost decision |
| --- | --- | --- |
| Existing beta URLs | No domain purchase | Public-repository Pages can be free, within terms/limits; resolve commercial use before monetisation |
| Custom domain | Optional | Registrar registration + annual renewal at the selected TLD's current quote; check renewal, privacy, recovery and MFA. One domain with two subdomains may suffice |
| Supabase | Existing project required; upgrade depends on workload/reliability | Free is $0; Pro currently starts at US$25/month plus applicable compute/usage. Check existing organisation billing before changing it; two games in one project do not automatically mean two plans |
| Database backups | A tested recovery plan is required for a durable launch | Pro includes daily backups retained seven days; manual/offsite backup operations and optional PITR have separate effort/cost. No need to buy a Supabase custom domain for the game websites |
| Publisher/H5 approval | Only for ads | Application/account work required; no approval or revenue purchased/promised by this checklist |
| CMP | Only when enabling relevant tracking/ads; choose before activation | Free or paid provider tier may fit; inspect actual regional functionality and traffic limits |
| Private support contact | Required owner action | Existing mailbox may suffice; custom-domain mailbox is optional |
| Monitoring/abuse controls | Required operational work | Start with available provider dashboards/logs and alerts; paid monitoring is optional until requirements justify it |
| Legal/tax/content review | Scope-specific launch action | Obtain a quote for the actual operator/jurisdictions; no invented universal filing fee or mandatory incorporation package |
| Verified Google/Apple/email sign-in | Optional future feature | Provider setup and implementation are separate; Apple membership and email-provider charges may apply. No paid SMTP is needed for the current unverified email profile |

## 9. From buying a domain to two working game addresses

One domain with two subdomains is the simplest starting choice: **`play.example.com` for AYD** and **`quiz.example.com` for JHK**. These are placeholders, not purchased names. The steps below apply if keeping GitHub Pages is appropriate for the chosen use; a different commercial host supplies its own DNS targets.

1. [ ] **Choose and buy the name yourself.** For example, compare the registration and renewal quote at [Cloudflare Registrar](https://www.cloudflare.com/domains/) with another registrar you trust. Check TLD availability, renewal price, contact privacy, transfer/DNS conditions and support. Enable MFA, recovery methods and renewal reminders. Do not buy separate domains unless you want separate brands.
2. [ ] **Verify ownership in GitHub first.** In the `occult-kranti` account's Settings → Pages, add the purchased domain; copy GitHub's exact TXT name/value into DNS and select Verify. Keep that TXT record. [Official verification steps](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).
3. [ ] **Prepare the two root-path builds.** Set AYD's workflow build `HISAAB_BASE=/` and JHK's `STATIC_BASE=/`. Update each game's canonical URL, Open Graph/share URLs, manifest links, sister-game links and any origin allowlists to the real new addresses. Retain the existing Supabase endpoints. Review the generated build before changing live URLs.
4. [ ] **Set each repository's Pages custom domain**, then add these DNS records using your real domain:

   | Repository | Pages custom domain | DNS type/name | DNS target |
   | --- | --- | --- | --- |
   | `andhbhakt-ya-deshbhakt` | `play.example.com` | CNAME `play` | `occult-kranti.github.io` |
   | `fact-duel` | `quiz.example.com` | CNAME `quiz` | `occult-kranti.github.io` |

   The targets contain **no `https://`, slash or repository path**. Avoid wildcard DNS. With the current custom Actions deployment, configure the domain in Pages settings; GitHub does not require a repository `CNAME` file. [Official custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
5. [ ] **Deploy, enable HTTPS and test.** Wait for DNS/certificate readiness, enable Enforce HTTPS, and check both new addresses. Test mobile reloads, assets, profiles, two-player invites, copied deep links, sister-game navigation and shared certificate/social image URLs. Compare `release.json` with the deployed commit. Update published links only after these checks pass.

## 10. Optional later: verified sign-in and recovery

**The current name/email profile is not Supabase Auth, Google OAuth or Sign in with Apple.** It sends no verification email and needs no paid SMTP. A private support mailbox is a separate requirement. Do not present a provider setup as already implemented or silently merge existing profiles by email.

- [ ] **Before any provider:** design explicit migration/linking from the existing device profile, server identity validation, cross-device recovery, sign-out/revocation and deletion. Configure exact production redirect URLs for both games and test account separation on the shared project. [Supabase redirect guide](https://supabase.com/docs/guides/auth/redirect-urls).
- [ ] **Google, if wanted:** create/configure a Google Cloud project, OAuth consent/branding and web client; register the real site origins and Supabase callback, store provider secrets in server/provider settings, and test through Supabase Auth. Request only needed identity scopes. [Official Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [ ] **Apple, if wanted:** check Apple Developer eligibility/current membership cost; configure the App ID, Services ID, domains/callback and signing key. Assign an owner to rotate the web OAuth secret every six months; handle Hide My Email identities without assuming the entered contact email matches. [Official Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple).
- [ ] **Email verification/magic links, if wanted:** configure a production SMTP provider and authenticated sending domain, sender address, templates, rate limits and exact redirects; test delivery, expired/reused links and recovery abuse. Supabase's default mail service is restricted and not intended for production. Compare provider free/paid tiers only when adopting this feature. [Official SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Leave unchecked owner decisions, deployments and external approvals visibly open; implemented integration points do not complete those actions.
