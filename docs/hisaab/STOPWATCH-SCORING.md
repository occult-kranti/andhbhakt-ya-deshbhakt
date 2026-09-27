# Stopwatch scoring — 27 September 2026

HISAAB DO replaces confidence choices with a stopwatch. A correct first answer earns 30 answer XP below 8,000 ms, 20 XP from 8,000 ms up to but excluding 15,000 ms, and 10 XP from 15,000 ms onward. Wrong answers earn 0 answer XP. Missing legacy timings receive no speed bonus. The progression log is the source of truth for the amount actually paid; receipts distinguish answer XP from other progression rewards.

Files, the daily five, and one-card links have no answer deadline. File score is accuracy out of six, so reading slowly does not reduce the accuracy score. Stopwatch XP advances the existing label/level progression. Receipt, first-file, quest, streak and match rewards remain separate. A Surprise Audit retains its multiplier as a separately recorded bonus equal to the answer XP times `(multiplier - 1)`; it never alters the stated base band. Existing due-review rewards are independent of stopwatch play.

Bot and friend duels allow 30 seconds for every format so all bands are reachable. The fastest correct-answer verdict and 150 ms tie rule remain intact. Pass & Play has a stopwatch for each seat but no deadline and no profile XP: times are recorded only in that in-memory game, and both correct answers still share the round regardless of speed.

## Time and failure handling

The timer begins after a double animation-frame reveal and measures elapsed time on the monotonic `performance.now()` clock. Display ticks do not render the question or its options again. The timer continues through backgrounding; throttled callbacks affect only drawing. Display tenths are truncated, so a 7,999 ms answer never displays as 8.0 seconds.

The first answer locks its choice and elapsed time synchronously before asynchronous persistence or transport. Repeated taps do not create more answers. A failed local write exposes an explicit retry that resubmits the same answer/time. P2P resend retains the original attempt ID and time. These are casual client-local measurements: browser modification, local data edits and timing resets through navigation are not prevented by a trusted server. P2P remains host-authoritative and trust-based, and no competitive timing authority is claimed.

## Replay and migration

Daily round identities reject duplicate writes. The latest claimed daily date and its five-bit mask also survive journal-row eviction; an older date cannot be reclaimed, and a newer date starts a new mask. One-card link rewards consult persistent discovery fact aggregates, so an old link cannot become a new reward when its journal row leaves the 200-row window. A fact already encountered in discovery or the daily earns no new discovery XP from its link. Files retain their fact-level replay guard and now pay zero answer XP on repeated cards and zero repeated completion XP. Existing once-only quests and achievements retain their own guards.

Legacy stored confidence fields and historical internal file scores remain readable to preserve profiles; they are not available as player choices. Files present accuracy from the stored correct-answer count. JHK keeps its original confidence system, XP and 10/7/5-second default duel formats through `lib/edition-rules.mjs`; only the HISAAB alias supplies stopwatch rules. P2P protocol version 2 prevents a version-1 client from pairing silently across the timing-rule change.

## Verification

`node --test tests/hisaab-stopwatch.test.mjs` covers exact 8s/15s boundaries, malformed time fallback, slow reading, actual progression awards, duplicate dispatch/reload, full six-card route replay, monotonic/background behavior, frozen transport retries, separately itemized Audit bonuses, Pass & Play accuracy, and more than 200 intervening journal entries before replay. Existing edition, controller, P2P and UI-foundation suites are also run for integration.
