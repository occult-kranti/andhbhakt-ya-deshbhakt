// Supabase Edge runtime. Intentionally no package dependencies.
// verify_jwt=false: custom 256-bit guest token is checked on EVERY private action.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
// @ts-nocheck -- deployed by Deno, separate from the browser TypeScript project.
import { GameError, validateInput, makeToken, hashToken } from './core.mjs';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-hisaab-session, x-region', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
const output = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
async function readBody(request) {
  if (Number(request.headers.get('content-length') || 0) > 4096) throw new GameError('TOO_LARGE','Request is too large.',413);
  const reader = request.body?.getReader(); if (!reader) return '';
  const chunks = []; let size = 0;
  try { while (true) { const {value,done}=await reader.read(); if (done) break; size+=value.byteLength; if(size>4096) { await reader.cancel(); throw new GameError('TOO_LARGE','Request is too large.',413); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const data=new Uint8Array(size); let offset=0; for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(data);
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return output({ok:false,error:{code:'METHOD',message:'Use POST.'}},405);
  try {
    const text = await readBody(request);
    if (text.length > 4096) throw new GameError('TOO_LARGE','Request is too large.',413);
    let body; try { body = JSON.parse(text); } catch { throw new GameError('BAD_JSON','Invalid request.'); }
    const { action, payload } = validateInput(body);
    const token = action === 'session' ? makeToken() : request.headers.get('x-hisaab-session');
    const tokenHash = await hashToken(token);
    // Hash network hints with a server-only secret. No raw IP is persisted or returned.
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
    const networkHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${ip}`))), b => b.toString(16).padStart(2,'0')).join('');
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/hisaab_game`, { method:'POST', signal:AbortSignal.timeout(12000), headers:{'Content-Type':'application/json',apikey:secret,Authorization:`Bearer ${secret}`}, body:JSON.stringify({p_session_hash:tokenHash,p_action:action,p_payload:payload,p_network_hash:networkHash}) });
    if (!response.ok) { console.error('hisaab_rpc_failure', response.status); throw new GameError('SERVER_BUSY','The game server is busy. Retry shortly.',503); }
    const data = await response.json();
    if (!data.ok) return output(data, ['UNAUTHORIZED','SESSION_EXPIRED'].includes(data.error?.code) ? 401 : data.error?.code === 'RATE_LIMIT' ? 429 : 400);
    if (action === 'session') data.token = token;
    return output(data);
  } catch (error) { return output({ok:false,error:{code:error instanceof GameError ? error.code : 'SERVER_ERROR',message:error instanceof GameError ? error.message : 'Unable to reach the game server.'}},error instanceof GameError ? error.status : 500); }
});
