import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCompetitionTitle, LABELS, labelForLevel } from '../editions/hisaab/engine/labels.mjs';
import { rotatingEdition, themePreference } from '../editions/hisaab/theme/preference.mjs';

test('daily rotation spans three editions and changes only on UTC-day boundaries', () => {
  assert.equal(rotatingEdition(0), 'light');
  assert.equal(rotatingEdition(86_399_999), 'light');
  assert.equal(rotatingEdition(86_400_000), 'dark');
  assert.equal(rotatingEdition(172_800_000), 'classic');
  assert.equal(rotatingEdition(259_200_000), 'light');
  assert.equal(rotatingEdition(-1), 'classic');
  assert.equal(rotatingEdition(NaN), 'light');
  for (const pref of ['light', 'dark', 'classic', 'rotate', 'system']) assert.equal(themePreference(pref), pref);
  for (const pref of [null, undefined, 'desh-bhakt', '', {}]) assert.equal(themePreference(pref), 'system');
});

const grant = { title: 'certified-antinational', source: 'leaderboard', rank: 1, competitionId: 'daily-quick:2026-09-27', awardedAt: 1_000, expiresAt: 2_000 };

test('competition honour exists only inside its server supplied time window, for ranks 1–10', () => {
  assert.equal(activeCompetitionTitle(grant, 999), null);
  assert.equal(activeCompetitionTitle(grant, 1_000)?.label, 'Certified Anti-National');
  assert.equal(activeCompetitionTitle(grant, 1_999)?.ordinal, 9);
  assert.equal(activeCompetitionTitle(grant, 2_000), null);
  for (let rank = 1; rank <= 10; rank++) assert.equal(activeCompetitionTitle({ ...grant, rank }, 1_001)?.rank, rank);
  for (const rank of [0, -1, 11, 1.5, '1', NaN, Infinity, null]) assert.equal(activeCompetitionTitle({ ...grant, rank }, 1_001), null);
  assert.equal(activeCompetitionTitle({ ...grant, source: 'tournament' }, 1_001)?.source, 'tournament');
});

test('no local progress, malformed or stale qualification can create the honour', () => {
  const invalid = [null, {}, { xp: 999_999 }, { ...grant, source: 'local' }, { ...grant, title: 'other' },
    { ...grant, competitionId: '' }, { ...grant, competitionId: ' '.repeat(4) }, { ...grant, competitionId: 'x'.repeat(129) },
    { ...grant, awardedAt: '1000' }, { ...grant, awardedAt: Infinity }, { ...grant, expiresAt: NaN },
    { ...grant, expiresAt: 900 }, { ...grant, expiresAt: 1_000 }];
  for (const bad of invalid) assert.equal(activeCompetitionTitle(bad, 1_001), null);
  assert.equal(activeCompetitionTitle(grant, NaN), null);
  assert.equal(LABELS.length, 9);
  assert.equal(LABELS.some((r) => r.label === 'Certified Anti-National' || r.ordinal === 9), false);
  assert.equal(labelForLevel(40).band, 8, 'existing highest XP band is unchanged');
  assert.equal(labelForLevel(40).ordinal, 10);
  assert.deepEqual(LABELS.map((r) => r.ordinal), [1, 2, 3, 4, 5, 6, 7, 8, 10]);
});

test('savings honour is reserved for first place and old grants are rejected', () => {
  assert.equal(activeCompetitionTitle({ ...grant, source: 'savings' }, 1001)?.label, 'Certified Anti-National');
  assert.equal(activeCompetitionTitle({ ...grant, source: 'savings', rank: 2 }, 1001), null);
  assert.equal(activeCompetitionTitle({ ...grant, title: 'desh-bhakt' }, 1001), null);
  assert.equal(LABELS[8].label, 'Deshbhakt');
});
