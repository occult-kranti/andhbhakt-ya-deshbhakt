import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY_RULES, DUEL_FILES, validateInput } from '../editions/hisaab/server/core.mjs';

test('optional wager is explicit, integral and bounded, including always available zero', () => {
  assert.deepEqual(validateInput({action:'queue'}).payload,{stake:0,file:'all'});
  for(const stake of [0,1,100,10000]) assert.equal(validateInput({action:'queue',stake,file:'media'}).payload.stake,stake);
  for(const stake of [-1,0.1,'100',Infinity,10001,Number.MAX_SAFE_INTEGER]) assert.throws(()=>validateInput({action:'queue',stake}),{code:'BAD_STAKE'});
});
test('bonus file contract is 10 times earned completion reward, never pot', () => {
  assert.equal(ECONOMY_RULES.completionReward,10);
  assert.equal(ECONOMY_RULES.completionReward*ECONOMY_RULES.bonusMultiplier,100);
  assert.deepEqual(DUEL_FILES.filter(f=>f.rewardMultiplier===10).map(f=>f.id),['subsidies','pre-election','media']);
  const payload=validateInput({action:'queue',file:'media',stake:20,rewardMultiplier:999,payout:999,balance:999,savings:999,reward:999,winnerId:'forged'}).payload;
  assert.deepEqual(payload,{file:'media',stake:20});
  assert.throws(()=>validateInput({action:'queue',file:'unknown'}),{code:'BAD_FILE'});
});
