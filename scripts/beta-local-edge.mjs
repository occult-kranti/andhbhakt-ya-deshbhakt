/** Local adapter runs the actual Edge handler against isolated PostgreSQL/WASM, not a fake game engine. */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function startLocalEdge() {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite');
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(readFileSync(new URL('../supabase/hisaab/schema.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/hisaab/seed-bank.sql', import.meta.url), 'utf8'));
  let handler, serial = Promise.resolve();
  const priorDeno = globalThis.Deno, realFetch = globalThis.fetch;
  globalThis.Deno = { env: { get: key => key === 'SUPABASE_URL' ? 'http://beta.local.invalid' : 'local-only-service-test' }, serve: fn => { handler = fn; } };
  globalThis.fetch = async (url, options) => {
    if (String(url) !== 'http://beta.local.invalid/rest/v1/rpc/hisaab_game') return realFetch(url, options);
    const args = JSON.parse(options.body);
    const execute = async () => {
      await db.exec('begin; set local role service_role;');
      try {
        const data = (await db.query('select public.hisaab_game($1,$2,$3::jsonb,$4) as data', [args.p_session_hash,args.p_action,JSON.stringify(args.p_payload),args.p_network_hash])).rows[0].data;
        await db.exec('commit'); return Response.json(data);
      } catch (error) { await db.exec('rollback'); throw error; }
    };
    const result = serial.then(execute); serial = result.catch(() => {}); return result;
  };
  await import('../supabase/hisaab/functions/hisaab-game/index.ts');
  const server = http.createServer(async (req, res) => {
    try {
      const chunks=[]; for await (const chunk of req) chunks.push(chunk);
      const response = await handler(new Request(`http://127.0.0.1${req.url}`, { method:req.method, headers:req.headers, ...(req.method === 'POST' ? {body:Buffer.concat(chunks)} : {}) }));
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500, {'content-type':'application/json'}); res.end('{"ok":false,"error":{"code":"LOCAL_ADAPTER"}}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url:`http://127.0.0.1:${server.address().port}/functions/v1/hisaab-game`, async close() { await new Promise(resolve => server.close(resolve)); globalThis.fetch=realFetch; globalThis.Deno=priorDeno; await db.close(); } };
}
