/** HISAAB's server transport. No answer keys, score computation, or credentials in URLs. */
import { STORAGE } from '../../../lib/storage-names.mjs';

export class OnlineError extends Error {
  constructor(message, code = 'NETWORK') { super(message); this.name = 'OnlineError'; this.code = code; }
}

/** @param {{url?:string, anonKey?:string, fetcher?:typeof fetch, storage?:Pick<Storage,'getItem'|'setItem'|'removeItem'>|null, clock?:()=>number, timeoutMs?:number}} options */
export function createOnlineClient({ url, anonKey = '', fetcher = globalThis.fetch, storage = null, clock = () => performance.now(), timeoutMs = 10000 } = {}) {
  let credential = null;
  let anchor = null;
  let bestRoundTrip = Infinity;
  try { credential = JSON.parse(storage?.getItem(STORAGE.serverSession) || 'null'); } catch { /* storage may be denied */ }
  if (!credential || !/^[a-f0-9]{64}$/.test(credential.token || '')) credential = null;
  const endpoint = typeof url === 'string' ? url.trim().replace(/\/$/, '') : '';
  const configured = /^https:\/\//.test(endpoint) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(endpoint);

  async function request(action, payload = {}, { signal } = {}) {
    if (!configured) throw new OnlineError('Online play is not connected on this build. You can still play every casual mode.', 'UNCONFIGURED');
    if (action !== 'session' && !credential) throw new OnlineError('Choose a nickname to connect first.', 'SESSION_REQUIRED');
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
      const ended = clock();
      if (Number.isFinite(data.serverNow) && ended - began < bestRoundTrip) {
        bestRoundTrip = ended - began;
        anchor = { server: data.serverNow, local: (began + ended) / 2 };
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
      credential = { ...credential, session: data.session };
      return data.session;
    }
    const data = await request('session', { nickname });
    if (!/^[a-f0-9]{64}$/.test(data.token || '') || !data.session?.id) throw new OnlineError('The server did not create a usable player identity.', 'BAD_SESSION');
    credential = { token: data.token, session: data.session };
    try { storage?.setItem(STORAGE.serverSession, JSON.stringify(credential)); } catch { /* current tab can still play */ }
    return data.session;
  }
  return {
    configured, request, connect,
    get session() { return credential?.session ?? null; },
    get latencyMs() { return Number.isFinite(bestRoundTrip) ? Math.round(bestRoundTrip) : null; },
    now: () => anchor ? anchor.server + clock() - anchor.local : Date.now(),
    rememberRoom(id) { try { id ? storage?.setItem(STORAGE.serverRoom, id) : storage?.removeItem(STORAGE.serverRoom); } catch {} },
    rememberedRoom() { try { return storage?.getItem(STORAGE.serverRoom) || null; } catch { return null; } },
    forget() { credential = null; try { storage?.removeItem(STORAGE.serverSession); storage?.removeItem(STORAGE.serverRoom); } catch {} },
  };
}
