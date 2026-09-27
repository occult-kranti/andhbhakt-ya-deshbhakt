# HISAAB DO server beta release

Release verification: 27 September 2026. Source branch:
`claude/loving-pasteur-s8xwtf`. Do not merge this edition into `main`.

## Implemented

- Supabase-refereed guest matchmaking and private five-round duels, with durable
  answers, private feedback, single settlement, reconnect and quit handling.
- Daily/weekly standings, a weekly score tournament, and server-stored circles
  with personal group nicknames.
- A hidden, temporary ninth display honour for qualifying top-ten competitors;
  permanent XP and the final ladder label remain intact.
- Day, Night and Classic palettes, with optional between-screen rotation.
- Investor deck source, six bilingual social drafts, campaign artwork, retention
  hypotheses and a service/operating plan. No promotional messages were sent.

## Evidence

The latest pre-release full suite passed **912/912** tests. During this release
continuation, TypeScript passed and **24/24** focused online-client, server-rule,
security-validator and theme/title tests passed. The root-path production build
passed the artifact verifier (207 files, 62 local references) and contains the
intended public game endpoint. No GitHub-token or Supabase-secret-key patterns
were found in its JavaScript.

Supabase reports project `wvupsqfevlrmhqfjreyx` as `ACTIVE_HEALTHY` and
`hisaab-game` version 1 as `ACTIVE`. The earlier live API run passed nine
integrity checks through five private rounds and concurrent answer replays.
The rollback-only database suite passed 51 assertions. See
[server QA](review/server-qa.md) for the saved evidence and its scope.

The saved browser UI fixture report contains 13 passing checks and no browser
errors. Earlier live browser work exercised a complete private match and locked
answer recovery, but the saved remaining-flow report stopped at an exact text
selector for the circle type control. The selector now uses its combobox role.
The new recheck could not reach the local test server in this execution session;
it is **not** counted as a passing browser run. Circle persistence and public
queue/quit browser completion remain follow-up verification items. API/SQL
integrity checks are distinct evidence, not substitutes for those UI checks.

## Pilot boundary

This is a functional online beta. Dispatch-to-answer time includes network and
device delay. The small live stress run does not prove low latency, equal
networks, cheat prevention or public capacity. Separate-phone, separate-network
measurement is still required before a competitive marketing campaign.

Profiles are device-bound guests without cross-device recovery. The learning
bank is public. Ads remain disabled. Broad anonymous promotion should follow
abuse controls, monitored support, alerts and a measured capacity target.

See [SERVER-LAUNCH.md](SERVER-LAUNCH.md) for the services and operating rules.
The publication IDs and exact source revision are recorded after deployment.
