/** HISAAB's server transport. No answer keys, score computation, or credentials in URLs. */
import { STORAGE } from '../../../lib/storage-names.mjs';

export class OnlineError extends Error {
  constructor(message, code = 'NETWORK') { super(message); this.name = 'OnlineError'; this.code = code; }
}

/** @param {{url?:string, anonKey?:string, fetcher?:typeof fetch, storage?:Pick<Storage,'getItem'|'setItem'|'removeItem'>|null, clock?:()=>number, timeoutMs?:number}} options */
export function createOnlineClient({ url, anonKey = '', fetcher = globalThis.fetch, storage = null, clock = () => performance.now(), timeoutMs = 10000 } = {}) {
  let credential = null;
  let credentialEpoch = 0;
  const listeners = new Set();
  const notifySession = () => { for (const listener of listeners) listener(); };
  let anchor = null;
  let bestRoundTrip = Infinity;
  try { credential = JSON.parse(storage?.getItem(STORAGE.serverSession) || 'null'); } catch { /* storage may be denied */ }
  if (!credential || !/^[a-f0-9]{64}$/.test(credential.token || '')) credential = null;
  const endpoint = typeof url === 'string' ? url.trim().replace(/\/$/, '') : '';
  const configured = /^https:\/\//.test(endpoint) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(endpoint);

  async function request(action, payload = {}, { signal } = {}) {
    if (!configured) throw new OnlineError('Online play is not connected on this build. You can still read practice files.', 'UNCONFIGURED');
    if (action !== 'session' && !credential) throw new OnlineError('Choose a nickname to connect first.', 'SESSION_REQUIRED');
    const startedEpoch = credentialEpoch;
    const startedToken = credential?.token ?? null;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const requestTimeout = action === 'session' || action === 'profile' ? Math.max(timeoutMs, 15000) : timeoutMs;
    const timer = setTimeout(() => controller.abort(), requestTimeout);
    const began = clock();
    try {
      const headers = { 'Content-Type': 'application/json', 'x-region': 'ap-south-1' };
      if (anonKey) { headers.apikey = anonKey; headers.Authorization = `Bearer ${anonKey}`; }
      if (credential && action !== 'session') headers['x-hisaab-session'] = credential.token;
      const response = await fetcher(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...payload, action }), signal: controller.signal, credentials: 'omit', cache: 'no-store' });
      let data;
      try { data = await response.json(); } catch { throw new OnlineError('The game server returned an unreadable response. Try reconnecting.', 'BAD_RESPONSE'); }
      if (!response.ok || !data?.ok) throw new OnlineError(data?.error?.message || 'The server could not complete this action.', data?.error?.code || `HTTP_${response.status}`);
      if (credentialEpoch !== startedEpoch || (credential?.token ?? null) !== startedToken) throw new OnlineError('The guest identity changed. Retry with the current profile.', 'SESSION_CHANGED');
      const ended = clock();
      if (Number.isFinite(data.serverNow) && ended - began < bestRoundTrip) {
        bestRoundTrip = ended - began;
        anchor = { server: data.serverNow, local: (began + ended) / 2 };
      }
      if (credential && data.session) {
        credential = { ...credential, session: data.session };
        try { storage?.setItem(STORAGE.serverSession, JSON.stringify(credential)); } catch {}
        notifySession();
      }
      if (credential && data.match?.economy) {
        const { balance, reserved, savings = balance + reserved } = data.match.economy;
        if (credential.session.balance !== balance || credential.session.savings !== savings) {
          credential = { ...credential, session: { ...credential.session, balance, savings } };
          notifySession();
        }
      }
      return data;
    } catch (error) {
      if (error instanceof OnlineError) throw error;
      if (signal?.aborted) throw new OnlineError('Request cancelled.', 'CANCELLED');
      throw new OnlineError('Connection interrupted. Retry to check the server’s latest state.', 'NETWORK');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }

  async function connect(nickname) {
    if (credential) {
      const data = await request('profile');
      return data.session;
    }
    const data = await request('session', { nickname });
    if (!/^[a-f0-9]{64}$/.test(data.token || '') || !data.session?.id) throw new OnlineError('The server did not create a usable player identity.', 'BAD_SESSION');
    credential = { token: data.token, session: data.session };
    credentialEpoch += 1;
    try { storage?.setItem(STORAGE.serverSession, JSON.stringify(credential)); } catch { /* current tab can still play */ }
    notifySession();
    return data.session;
  }
  return {
    configured, request, connect,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    get session() { return credential?.session ?? null; },
    get latencyMs() { return Number.isFinite(bestRoundTrip) ? Math.round(bestRoundTrip) : null; },
    now: () => anchor ? anchor.server + clock() - anchor.local : Date.now(),
    rememberRoom(id) { try { id ? storage?.setItem(STORAGE.serverRoom, id) : storage?.removeItem(STORAGE.serverRoom); } catch {} },
    rememberedRoom() { try { return storage?.getItem(STORAGE.serverRoom) || null; } catch { return null; } },
    forget() { credential = null; credentialEpoch += 1; notifySession(); try { storage?.removeItem(STORAGE.serverSession); storage?.removeItem(STORAGE.serverRoom); } catch {} },
  };
}
