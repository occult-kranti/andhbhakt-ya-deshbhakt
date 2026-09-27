/** Static-hosted circles. Invites are bearer secrets, never accounts or verified identities. */
export const CIRCLE_LIMITS = Object.freeze({ circles: 20, members: 32, name: 40, nickname: 24, invite: 700 });
const ID = /^[a-f0-9]{32}$/;
const badText = /[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;

export function circleText(value, kind = 'nickname') {
  const limit = kind === 'name' ? CIRCLE_LIMITS.name : CIRCLE_LIMITS.nickname;
  if (typeof value !== 'string' || badText.test(value)) throw new Error('Use a plain-text name, without markup or hidden control characters.');
  const text = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!text || [...text].length > limit) throw new Error(`Use 1–${limit} characters for ${kind === 'name' ? 'the circle name' : 'your nickname'}.`);
  return text;
}

export function randomCircleId(cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) throw new Error('A secure browser is required to create a circle.');
  return [...cryptoApi.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
}

export function encodeInvite(circle) {
  if (!ID.test(circle.id)) throw new Error('Invalid circle.');
  const meta = JSON.stringify({ n: circleText(circle.name, 'name'), k: circle.kind === 'family' ? 'family' : 'friends' });
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(meta))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `HD1.${circle.id}.${encoded}`;
}

export function decodeInvite(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Paste a complete circle invite link or invite code.');
  let text = input.trim();
  if (text.includes('#')) {
    const hash = text.slice(text.indexOf('#') + 1);
    if (!hash.startsWith('/circles?')) throw new Error('This is not a circle invite.');
    text = new URLSearchParams(hash.slice(hash.indexOf('?') + 1)).get('invite') ?? '';
  }
  if (text.length > CIRCLE_LIMITS.invite) throw new Error('This invite is too long. Ask for a new invite.');
  const match = /^HD1\.([a-f0-9]{32})\.([A-Za-z0-9_-]+)$/.exec(text);
  if (!match) throw new Error('This invite is incomplete. Ask your friend for the full link or code.');
  try {
    const raw = match[2].replace(/-/g, '+').replace(/_/g, '/');
    const meta = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0))));
    if (!['family', 'friends'].includes(meta.k)) throw new Error();
    return { id: match[1], name: circleText(meta.n, 'name'), kind: meta.k };
  } catch { throw new Error('This invite is damaged. Ask your friend for a fresh copy.'); }
}

export function newCircle({ name, kind = 'friends', nickname }, cryptoApi = globalThis.crypto, now = Date.now()) {
  if (!['friends', 'family'].includes(kind)) throw new Error('Choose friends or family.');
  return { id: randomCircleId(cryptoApi), name: circleText(name, 'name'), kind,
    nickname: circleText(nickname), memberId: randomCircleId(cryptoApi), createdAt: now, members: [] };
}

/** Discard corrupt records, unknown properties, unbounded lists and executable-looking labels. */
export function normalizeCircles(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const c of value.slice(0, CIRCLE_LIMITS.circles)) {
    try {
      if (!c || !ID.test(c.id) || !ID.test(c.memberId) || result.some(x => x.id === c.id) || !['friends', 'family'].includes(c.kind)) continue;
      const members = [];
      for (const m of (Array.isArray(c.members) ? c.members : []).slice(0, CIRCLE_LIMITS.members)) {
        try {
          if (m && ID.test(m.id) && m.id !== c.memberId && !members.some(x => x.id === m.id))
            members.push({ id: m.id, nickname: circleText(m.nickname), lastSeen: Number.isFinite(m.lastSeen) ? m.lastSeen : 0 });
        } catch { /* one invalid peer must not erase a circle */ }
      }
      result.push({ id: c.id, memberId: c.memberId, name: circleText(c.name, 'name'), nickname: circleText(c.nickname), kind: c.kind,
        createdAt: Number.isFinite(c.createdAt) ? c.createdAt : 0, members });
    } catch { /* corrupt record */ }
  }
  return result;
}

export function validPresence(value) {
  try {
    if (!value || value.v !== 1 || !ID.test(value.id)) return null;
    return { id: value.id, nickname: circleText(value.nickname), xp: Math.min(1e9, Math.max(0, Math.floor(Number(value.xp) || 0))) };
  } catch { return null; }
}
