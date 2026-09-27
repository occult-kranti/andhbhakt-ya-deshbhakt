import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { hashRecovery, validateInput } from '../supabase/hisaab/functions/hisaab-game/core.mjs';

const enabled = Boolean(process.env.PGLITE_MODULE_PATH);
const create = { action:'session', nickname:'Player One', email:'player@example.test', adultConfirmed:true, termsVersion:'beta-1' };

test('profile input requires attestation and limits optional fields', async () => {
 for (const omitted of ['email','adultConfirmed','termsVersion']) {
  const body={...create}; delete body[omitted];
  assert.throws(()=>validateInput(body),{code:'PROFILE_REQUIRED'});
 }
 assert.throws(()=>validateInput({...create,adultConfirmed:false}),{code:'AGE_CONFIRMATION_REQUIRED'});
 assert.throws(()=>validateInput({...create,avatar:'http://remote'}),{code:'BAD_AVATAR'});
 assert.throws(()=>validateInput({...create,preferences:{admin:true}}),{code:'BAD_PREFERENCES'});
 assert.equal(validateInput({...create,email:'  PLAYER@EXAMPLE.TEST '}).payload.email,'player@example.test');
 assert.notEqual(await hashRecovery('a'.repeat(64)),createHash('sha256').update('jhk:recovery:'+'a'.repeat(64)).digest('hex'));
});

test('actual Edge + SQL create/recover/rotate/delete preserves identity and credential boundaries', {skip:!enabled}, async () => {
 const {startLocalEdge}=await import('../scripts/beta-local-edge.mjs');
 const edge=await startLocalEdge();
 const call=async(body,token)=>{
  const response=await fetch(edge.url,{method:'POST',headers:{'content-type':'application/json',...(token?{'x-hisaab-session':token}:{})},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 };
 try {
  for (const bad of [{...create,email:undefined},{...create,adultConfirmed:false},{...create,termsVersion:'unknown'}]) assert.equal((await call(bad)).data.ok,false);
  const first=(await call(create)).data;
  assert.equal(first.ok,true); assert.match(first.token,/^[a-f0-9]{64}$/); assert.match(first.recoveryCode,/^[a-f0-9]{64}$/);
  assert.equal(first.session.profileComplete,true); assert.equal(first.session.email,create.email);
  const duplicate=(await call({...create,nickname:'Player Two'})).data;
  assert.equal(duplicate.ok,true); assert.notEqual(duplicate.session.id,first.session.id); // Unverified email is not proof of ownership.
  const other=(await call({action:'recover',recoveryCode:'f'.repeat(64)})).data;
  assert.equal(other.error.code,'BAD_RECOVERY'); assert.equal('session' in other,false);
  const recovered=(await call({action:'recover',recoveryCode:first.recoveryCode})).data;
  assert.equal(recovered.session.id,first.session.id); assert.equal(recovered.session.balance,first.session.balance);
  assert.notEqual(recovered.token,first.token);
  assert.equal((await call({action:'profile'},first.token)).data.error.code,'UNAUTHORIZED');
  assert.equal((await call({action:'profile'},recovered.token)).data.session.email,create.email);
  const rotated=(await call({action:'rotateRecovery'},recovered.token)).data;
  assert.match(rotated.recoveryCode,/^[a-f0-9]{64}$/);
  assert.notEqual(rotated.recoveryCode,first.recoveryCode);
  assert.equal((await call({action:'recover',recoveryCode:first.recoveryCode})).data.error.code,'BAD_RECOVERY');
  const exported=(await call({action:'exportProfile'},recovered.token)).data;
  assert.equal(exported.profile.email,create.email); assert.ok(Array.isArray(exported.answers));
  assert.equal((await call({action:'deleteSession'},recovered.token)).data.deleted,true);
  assert.equal((await call({action:'recover',recoveryCode:rotated.recoveryCode})).data.error.code,'BAD_RECOVERY');
 } finally {await edge.close();}
});
