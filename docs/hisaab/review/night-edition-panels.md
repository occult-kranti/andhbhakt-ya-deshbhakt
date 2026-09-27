# HISAAB DO: immediate feedback, Night edition, standalone launch

Baseline: `ea25dbea737b5bda97e206f4886e296d1f5dbee8`, branch `claude/loving-pasteur-s8xwtf`.

The owner requested three implementation loops, each with two discussion rounds. The independent
review perspectives are AI brand/color/typography designer, psychology-informed visual artist,
senior technical UI/UX designer, gameplay engineer, launch engineer and QA reviewer. The root
agent moderates and integrates. These reviews are not human usability research or professional
psychological endorsement. Detailed source references are in each role's companion report.

## Loop 1 — diagnose, challenge, implement

Round 1 reviewed the baseline code and previously captured browser screenshots. The brand reviewer
identified insufficient separation between the brown/olive night surfaces and inconsistent identity
on static publication pages. UX identified an icon-only quit action and no settings control during
countdown. The psychology reviewer identified idle waiting after a response and the need to protect
an unanswered opponent's opportunity. Engineering established that bot choices/times are already
precommitted, human rounds already settle after both answers, and the service seals answer times
before settlement. Launch review established that the existing Supabase project is inactive and
the current game has no Supabase dependency. The existing Sites identity belongs to FACT//DUEL.

Round 2 challenged the proposed behavior and resolved the tradeoffs below. These decisions drive
the first implementation; later loops must review the changed artifact, not repeat this baseline.

| Finding / impact | Decision and owner | Acceptance check |
| --- | --- | --- |
| Bot idle wait after player's answer | Gameplay: seal answer, immediately resolve using precommitted bot choice/time; edition-gated service advancement | Valid first submission returns result without unused deadline; sampled outcome unchanged; JHK default unchanged |
| Human player needs immediate feedback while opponent still has a turn | Gameplay + UX: private personal receipt for answered seat, shared verdict when both answer or deadline | Host-first and guest-first projections do not disclose answer to unanswered seat; no premature winner, Continue or XP |
| Quit/settings inaccessible during some phases | UX: labeled Settings action, accessible modal, theme/audio controls, explicit running-clock notice, separate quit confirmation | Keyboard focus/return, Escape, no background shortcuts, no paused/reset clocks, prompt exit even after disconnect |
| Dark surface hierarchy and brand drift | Brand: charcoal-violet Night edition, warm text, distinct paper layers, repeated violet marker/nameplate | Light token values unchanged; text/control contrast; narrow and wide English/Hindi review |
| Publication must be separate from other game | Root + launch: dedicated root-path static deployment; preserve original hosting manifest and branch isolation | Full asset/route build validation; successful separate deployment; other game remains unchanged |
| Optional cloud functionality could be misrepresented | Launch: document local profile/circle storage and peer limitations; no fabricated Supabase connection | Service checklist distinguishes current play from durable authenticated roster/authoritative competition |

Round 2 guards: a private receipt says "Your answer" while the opponent is still answering; earned
XP and the winner wait for shared settlement. The menu cannot allow underlying answer shortcuts,
pause the timer, trap focus, or strand the player if settlement happens while it is open. Bot
presentation fast-forward never changes its precommitted response measurement. Ads stay disabled.

## Loop 2 — inspect the changed artifact, challenge, correct

Round 1 reviewed the changed working tree, the root-path production build at
`/tmp/hisaab-loop1-production`, and twelve captured brand views. The engineer reported 91 passing
targeted mechanics tests. The independent reviewers found three concrete integration defects:
stale unfinished-match quit copy if settlement arrives while the dialog is open; the Arena effect
cancelling the personal receipt's polite announcement; and public pages following the OS theme
instead of the user's explicit in-game preference. The psychology reviewer also found that a
closed-menu gameplay screenshot still lacked the compact nameplate.

Round 2 accepted these bounded corrections. Keep the settings dialog open during settlement,
reset the stale quit confirmation, and update its note without taking focus away. Treat private
receipt announcements like shared receipt announcements. Public pages will read only the edition's
theme preference with a safe OS fallback. The designer preferred omitting another timed-header
mark; the moderator chose a small passive wordmark above the format because the owner requested
identity across the entire game. It has no action or motion and must pass narrow-screen checks.
The menu also reuses the shared brand component. No further palette change or new feature was
accepted. UX owns state/announcement/header fixes; brand owns publication preference consistency.

The initial brand matrix measured 118 readable-text/control/focus pairs without failures, with
all prior light color tokens unchanged. The full browser interaction gate is running against the
frozen first-loop build; its findings will inform the third loop rather than be hidden by edits.

## Loop 3 — challenge the candidate, verify and release

Round 1 reviewed the second implementation and executed QA. All 84 static page/layout cells
passed. Bot receipts appeared in 31–42 ms and private human receipts in 52–63 ms in the initial
local run; these measurements are not WAN latency promises. Review found an old dark color in
the first-paint inline style and required runtime evidence for settlement while Settings is open,
long names, and both peer-departure directions. Brand and psychology agreed no new feature or
palette direction was needed. The real WebRTC attempt could not contact the external signaling
relays; this limitation must remain separate from passing local protocol/UI tests.

Round 2 accepted the first-paint correction and the finite verification list. It also authorized
fixes only for observed blockers: the connection-opening/joining screen lacked Cancel, and a
24-character unbroken Pass & Play name overflowed a 320px screen. UX added immediate cancellation
with late-response guards and wrapped the turn label. The host-departure check was corrected to
respect the existing 10-second disconnect grace; the leaving player's own exit stays prompt.

Executed follow-up evidence: real deadline expiry under an open quit confirmation updates the
dialog and preserves focus; English/Hindi settings preserve the timer and block underlying answer
keys; a personal answer remains announced; both answer orders keep unsubmitted projections sealed;
no provisional XP is written. Pending-join Cancel returned to setup in 62/54 ms locally and stayed
there beyond the request timeout. Brand reviewed 15 final browser cases, including forced theme
preferences across public pages, a 320px Hindi round header/menu and OS fallback without JavaScript.

## Evidence and release

- Full unit/integration suite: **888 passed**, including both game engines; type check and bank
  structural validation passed. The question bank was not freshly fact-checked by this UI work.
- Original game's static build and HISAAB root build passed. The standalone package has 195 files,
  validated local references, all publication pages, and 389-row CSV/XLSX exports with its own host.
- **198** readable-text/control/focus contrast pairs passed; existing light color tokens stayed
  unchanged. The generated publication theme bridge passes six fallback/preference scenarios.
- Final interaction evidence and raw-run limitations are in `session-qa.md`; palette/render evidence
  is in `brand-panel.md`, `brand-contrast.json`, and `brand-runtime-checks.json`.
- All **27 distinct browser checks** have passing evidence across the frozen candidates and
  focused follow-ups. The final long-name check confirms a 320px document at a 320px viewport.
  Earlier harness mistakes and the actual wrapping defect remain recorded with their corrections.
- Real Internet peer connectivity is **not verified**: all five attempted Nostr relays returned
  WebSocket `ERR_EMPTY_RESPONSE` in this environment. No trusted server, cloud accounts, centrally
  synced circles or Supabase integration is implied. The visible Supabase project is inactive and
  unchanged. `../STANDALONE-LAUNCH.md` lists the exact service decisions for those capabilities.

All three loops contain two distinct discussion rounds, and each later loop reviewed the previous
implementation. The authorized release remains the HISAAB branch only, without a merge to main.
