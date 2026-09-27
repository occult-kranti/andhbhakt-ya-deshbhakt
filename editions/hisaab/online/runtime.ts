import { createOnlineClient } from './client.mjs';
const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
let storage: Storage | null = null;
try { storage = typeof window === 'undefined' ? null : window.localStorage; } catch { /* private-mode denial */ }
export const online = createOnlineClient({ url: env.VITE_HISAAB_SERVER_URL || '', anonKey: env.VITE_HISAAB_SUPABASE_ANON_KEY || '', storage });
