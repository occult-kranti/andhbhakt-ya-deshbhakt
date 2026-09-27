/**
 * editions/hisaab/p2p/protocol.mjs — Duel a Friend with no server: the host's browser IS the server.
 *
 * The host runs JHK's real duel service (`dispatch` from lib/server/duel-service.mjs) against its own
 * in-memory room store, exactly as the static build does for a bot duel. The guest's browser sends
 * the very same request bodies a JHK client sends to `/api/duel` (join, ready, reveal, answer, state,
 * leave, clock) over a transport (transport.mjs), and gets back the very same room projections. So
 * the rules — correctness first; both correct → the shorter reveal-to-input time wins unless the two
 * are within 150 ms (a draw); the timers, the formats, the transport-grace timing checks — are the
 * engine's, not a copy. Any screen that can drive a bot duel through `request()` can drive a friend
 * duel through `session.request()`.
 *
 * The room secret. The 8-character code is what people read aloud and type, but it is never used
 * on the network as it is: `roomSecret(code)` stretches it with PBKDF2 (P2P_KDF) and everything else
 * comes from that secret — the WebRTC rendezvous topic and password (trystero.mjs), the duel room id,
 * the invitation token the second seat needs, the deal seed and the rematch rooms (`roomKeys`,
 * `rematchCode`). The public relays only ever see a hash of the stretched secret, so recovering a
 * code from what they publish costs P2P_KDF.iterations PBKDF2 rounds per guess (P2P_TRUST.code says
 * what that leaves exposed).
 *
 * Shared seed. The room secret seeds the deal: the host creates the room with an RNG seeded from
 * `roomKeys(code).seed`, so the deck is `dealFromSeed(seed, config)` — which the guest computes from
 * its own copy of the edition bank and checks each revealed question against (`session.verify(room)`).
 * A hello handshake compares protocol and bank fingerprints first (the fingerprint covers every
 * item's content, not just its id), so two builds with different banks refuse to pair.
 *
 * Honesty. This is CASUAL and TRUST-BASED (`P2P_TRUST`): the host's browser is authoritative, and
 * each browser reports its own reveal-to-input time, which a modified browser can forge. No coins,
 * no ranking, no record beyond each player's own device. Say so on screen.
 *
 * Messages: { t: 'hello', protocol, bank, role } · { t: 'req', id, body } · { t: 'res', id, ok,
 * result | error } · { t: 'poke' } (the other side changed the room: poll now).
 */
import { dispatch } from '../../../lib/server/duel-service.mjs';
import { MemoryRoomStore } from '../../../lib/duel-memory-store.mjs';
import { chooseDeck, normalizeConfig, MODE_DURATION } from '../../../lib/server/room-engine.mjs';
import { QUESTIONS } from '../server/bank.mjs';

export const P2P_PROTOCOL = 'hisaab-duel/2';

export const P2P_TRUST = Object.freeze({
  label: 'Casual · trust-based',
  body:
    "The host's browser runs the match and each browser reports its own reveal-to-answer time, so a " +
    'modified browser could cheat. Fine between friends. No coins and no Babu rank: a friend duel pays XP ' +
    'on each device, and each device keeps its own record.',
  code:
    'The room code is the only key to the room. The public relays see a scrambled, stretched form of it ' +
    'that takes a lot of computing power to reverse, but someone who spends that could still work out a ' +
    "code later, and with it both players' internet (IP) addresses. Send the code only to your friend.",
});

/**
 * How a room code is stretched into the room secret: PBKDF2-HMAC-SHA-256 (WebCrypto has no scrypt or
 * Argon2). 600,000 rounds is OWASP's figure for PBKDF2-SHA-256; about 0.1 s on a laptop, around a
 * second on a slow phone, once per code (the secret is cached for the tab).
 */
export const P2P_KDF = Object.freeze({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000, salt: 'hisaab-do.duel/room-secret/1' });

/** Actions a guest may send. `create` and `add_bot` are the host's alone. */
export const GUEST_ACTIONS = Object.freeze(['join', 'ready', 'reveal', 'answer', 'state', 'leave', 'clock']);
const MUTATING = new Set(['join', 'ready', 'reveal', 'answer', 'leave']);

/** Room-code alphabet: no 0/O, 1/I/L, so a code read aloud or off a screen survives. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

// ---------------------------------------------------------------------------------------------
// Codes, keys, seeds

function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** A fresh room code, 'ABCD-EFGH'. `bytes` is injectable for tests. */
export function makeRoomCode(bytes = randomBytes(CODE_LENGTH)) {
  const chars = Array.from(bytes.slice(0, CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** A typed or pasted code in canonical 'ABCD-EFGH' form, or null when it is not one. */
export function normalizeCode(text) {
  const raw = String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (raw.length !== CODE_LENGTH || [...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

async function sha256(text) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return new Uint8Array(bytes);
}
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** code → Promise<secret>. One stretch per code per tab; rematch rooms are registered by rematchCode. */
const SECRETS = new Map();

/**
 * The room secret for a code (base64url, 256 bits of PBKDF2 output). Cached, so the transport and
 * the session that share a code pay for the stretch once.
 */
export function roomSecret(code) {
  const c = normalizeCode(code);
  if (!c) return Promise.reject(codeError());
  let secret = SECRETS.get(c);
  if (!secret) {
    secret = (async () => {
      const subtle = globalThis.crypto.subtle;
      const key = await subtle.importKey('raw', new TextEncoder().encode(c), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits(
        { name: 'PBKDF2', hash: P2P_KDF.hash, salt: new TextEncoder().encode(P2P_KDF.salt), iterations: P2P_KDF.iterations },
        key,
        256,
      );
      return base64url(new Uint8Array(bits));
    })();
    secret.catch(() => SECRETS.delete(c));
    SECRETS.set(c, secret);
  }
  return secret;
}

/**
 * What both browsers derive from the code, all of it from the stretched room secret (never from the
 * short code itself): the duel room id, the invitation token the duel service requires (so only
 * someone holding the code can take the second seat), the deal seed, and the WebRTC rendezvous
 * `topic` and `password` the trystero transport uses.
 */
export async function roomKeys(code) {
  const c = normalizeCode(code);
  if (!c) throw codeError();
  const secret = await roomSecret(c);
  const part = async (label) => sha256(`${P2P_PROTOCOL}:${label}:${secret}`);
  return {
    code: c,
    roomId: hex(await part('room')).slice(0, 32),
    invite: base64url(await part('invite')),
    seed: base64url(await part('deal')),
    topic: `duel-${hex(await part('topic')).slice(0, 40)}`,
    password: base64url(await part('password')),
  };
}

/**
 * The code of rematch `n` (1, 2, …) after the room opened with `first`. Both browsers compute the same
 * one without sending anything but "rematch". It comes from the first room's SECRET, not its code,
 * and the new room's secret is derived from that secret too (registered here), so a rematch costs no
 * second stretch. A rematch reuses the first room's transport; its code is never typed.
 */
export async function rematchCode(first, n) {
  const c = normalizeCode(first);
  if (!c) throw codeError();
  if (!Number.isSafeInteger(n) || n < 1) throw clientError('Rematch number must be 1 or more.', 'invalid_request', 400);
  const secret = await roomSecret(c);
  const next = base64url(await sha256(`${P2P_PROTOCOL}:rematch:${n}:${secret}`));
  const code = makeRoomCode(await sha256(`${P2P_PROTOCOL}:rematch-code:${next}`));
  SECRETS.set(code, Promise.resolve(next));
  return code;
}

function fnv1a32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The deal RNG for a seed (`roomKeys(code).seed`). Both browsers build the same one. */
export const seededRng = (seed) => mulberry32(fnv1a32(`${P2P_PROTOCOL}:deal:${normalizeCode(seed) ?? seed}`));

/** JSON with object keys sorted, so the same content always prints the same way. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
const FINGERPRINTS = new WeakMap();

/**
 * A short fingerprint of a bank, compared in the hello so mismatched builds refuse to pair. It covers
 * every field of every item (question, options, correctIndex, explanation, status, …), so an editorial
 * edit under the same id changes it: the host would otherwise deal and score from the old text while
 * the guest checks and shows the new one.
 */
export function bankFingerprint(questions = QUESTIONS) {
  let fingerprint = FINGERPRINTS.get(questions);
  if (!fingerprint) {
    fingerprint = `${questions.length}:${fnv1a32(questions.map(canonicalJson).join('\n')).toString(16)}`;
    FINGERPRINTS.set(questions, fingerprint);
  }
  return fingerprint;
}

/** A friend room's config, completed the way the host sends it: free, human opponent, format timer. */
export function friendConfig(config = {}) {
  const mode = config.mode ?? 'quick';
  return {
    domain: 'all',
    region: 'all',
    topic: 'all',
    subtopic: 'all',
    difficulty: 'all',
    duration: MODE_DURATION[mode] ?? MODE_DURATION.quick,
    ...config,
    mode,
    stake: 0,
    opponent: 'friend',
  };
}

/** The deck a room with this seed and config deals: identical on both browsers for the same bank. */
export function dealFromSeed(seed, config, questions = QUESTIONS) {
  const cfg = normalizeConfig(friendConfig(config), questions);
  return chooseDeck(questions, cfg, seededRng(seed));
}

// ---------------------------------------------------------------------------------------------
// Errors in the duel client's shape: an Error with `.code` and `.status`.

function clientError(message, code = 'p2p_error', status = 503) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
const codeError = () => clientError('Enter the 8-character room code.', 'invalid_code', 400);
const plain = (e) => ({
  message: e?.message || 'Something went wrong.',
  code: e?.code || 'invalid_request',
  status: Number.isInteger(e?.status) ? e.status : 400,
});
const randomToken = () => hex(randomBytes(24));

function listeners() {
  const set = new Set();
  return {
    on(fn) {
      set.add(fn);
      return () => set.delete(fn);
    },
    emit(v) {
      for (const fn of [...set]) fn(v);
    },
  };
}

/** Both sides greet on start and on every peer join; the first mismatching hello is fatal. */
function handshake(transport, role, bank, onMismatch) {
  const hello = { t: 'hello', protocol: P2P_PROTOCOL, bank, role };
  let seen = null;
  const ready = listeners();
  const offPeer = transport.onPeer((event) => {
    if (event === 'join') transport.send(hello);
  });
  const offMessage = transport.onMessage((m) => {
    if (m?.t !== 'hello') return;
    const fresh = !seen;
    seen = m;
    if (m.protocol !== P2P_PROTOCOL || m.bank !== bank || m.role === role) {
      onMismatch(
        m.protocol !== P2P_PROTOCOL
          ? 'Your friend is on a different version of the game. Both of you reload and try again.'
          : m.bank !== bank
            ? 'Your friend has a different question bank. Both of you reload the page and try again.'
            : role === 'host'
              ? 'Two hosts: one of you should join with the code instead.'
              : 'Two guests: one of you should host.',
      );
      return;
    }
    if (fresh) {
      transport.send(hello);
      ready.emit(m);
    }
  });
  transport.send(hello);
  return {
    get peer() {
      return seen;
    },
    onReady: ready.on,
    stop() {
      offPeer();
      offMessage();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Host

/**
 * The host's session. `start()` creates the room (seat 0); `request(body)` is the host's own
 * `lib/duel-client` `request`, with the room id and token filled in. The guest's requests arrive over
 * the transport and are answered by the same `dispatch`.
 *
 * @param {object} options
 * @param {object} options.transport a transport (transport.mjs)
 * @param {string} options.code the room code (makeRoomCode())
 * @param {string} options.name the host's display name (1–24 chars)
 * @param {object} [options.config] { mode, duration?, topic?, difficulty?, … } — see friendConfig
 * @param {() => number} [options.clock] the host's wall clock (tests pass a virtual one)
 */
export function createP2PHost({ transport, code, name, config = {}, clock = () => Date.now() }) {
  const canonical = normalizeCode(code);
  if (!canonical) throw codeError();
  const store = new MemoryRoomStore({ clock });
  const token = randomToken();
  const pokes = listeners(),
    peers = listeners(),
    errors = listeners();
  let keys = null,
    guestToken = null,
    closed = false,
    fatal = null;
  // A fresh RNG per call from the room's seed, as before: the deal is drawn by `create` alone.
  const call = (body, actor) =>
    dispatch(store, body, { now: clock(), actor, useDatabaseClock: true, principalId: null, rng: seededRng(keys.seed) });
  const shake = handshake(transport, 'host', bankFingerprint(), (message) => {
    fatal = clientError(message, 'p2p_mismatch', 409);
    errors.emit(fatal);
  });

  const offMessage = transport.onMessage(async (m) => {
    if (m?.t === 'poke') return pokes.emit('guest');
    if (m?.t !== 'req' || !Number.isSafeInteger(m.id)) return;
    const reply = (payload) => transport.send({ t: 'res', id: m.id, ...payload });
    try {
      if (fatal) throw fatal;
      const body = m.body && typeof m.body === 'object' ? m.body : {};
      if (!GUEST_ACTIONS.includes(body.action)) throw clientError('Unknown action.', 'invalid_request', 400);
      if (!keys) throw clientError('The host is still opening the room. Try again.', 'not_ready', 409);
      if (body.action === 'clock') return reply({ ok: true, result: { serverNow: clock(), clockSource: 'p2p-host' } });
      // One guest per room: once a seat is taken, only its token may act for it.
      if (guestToken && body.token !== guestToken) throw clientError('This room already has two players.', 'room_full', 409);
      const result = await call({ ...body, roomId: keys.roomId }, 'guest');
      if (body.action === 'join') guestToken = body.token;
      reply({ ok: true, result });
      if (MUTATING.has(body.action)) pokes.emit('guest');
    } catch (error) {
      reply({ ok: false, error: plain(error) });
    }
  });
  const offPeer = transport.onPeer(async (event) => {
    peers.emit(event);
    // The guest left mid-match: settle it the way a JHK room settles a leave (refund, no winner).
    if (event === 'leave' && guestToken && keys && !closed) {
      try {
        await call({ action: 'leave', roomId: keys.roomId, token: guestToken }, 'guest');
        pokes.emit('peer-left');
      } catch {
        /* already settled */
      }
    }
  });

  return {
    role: 'host',
    code: canonical,
    token,
    get roomId() {
      return keys?.roomId ?? null;
    },
    get peer() {
      return shake.peer;
    },
    /** Create the room. Resolves with `{ room }` (seat 0, phase 'waiting'). */
    async start() {
      keys = await roomKeys(canonical);
      return call(
        { action: 'create', roomId: keys.roomId, token, invite: keys.invite, name, config: friendConfig(config) },
        'host',
      );
    },
    /** The host seat's `request()`: same bodies and results as lib/duel-client's. */
    async request(body) {
      if (fatal) throw fatal;
      if (!keys) throw clientError('Start the room first.', 'not_ready', 409);
      if (body?.action === 'clock') return { serverNow: clock(), clockSource: 'p2p-host' };
      try {
        const result = await call({ ...body, roomId: keys.roomId, token }, 'host');
        if (MUTATING.has(body?.action)) transport.send({ t: 'poke' });
        return result;
      } catch (error) {
        throw clientError(plain(error).message, plain(error).code, plain(error).status);
      }
    },
    /** `fn(source)` whenever the guest changed the room: poll `state` now. */
    onPoke: pokes.on,
    /** `fn('join' | 'leave')` as the other browser arrives or goes. */
    onPeer: peers.on,
    /** `fn(error)` on a fatal handshake mismatch. */
    onError: errors.on,
    async close() {
      closed = true;
      shake.stop();
      offMessage();
      offPeer();
      await transport.close();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Guest

/**
 * The guest's session. `join()` waits for the host's hello, then takes seat 1 with the invitation
 * derived from the code. `request(body)` sends any guest action over the transport and resolves with
 * the host's `dispatch` result, or throws the duel client's Error shape.
 *
 * @param {object} options
 * @param {object} options.transport
 * @param {string} options.code the code the host shared
 * @param {string} options.name the guest's display name (1–24 chars)
 * @param {number} [options.timeoutMs] per request, and for the host's hello (default 8000)
 */
export function createP2PGuest({ transport, code, name, timeoutMs = 8000 }) {
  const canonical = normalizeCode(code);
  if (!canonical) throw codeError();
  const token = randomToken();
  const pending = new Map();
  const pokes = listeners(),
    peers = listeners(),
    errors = listeners();
  let next = 1,
    fatal = null,
    keys = null,
    deck = null,
    deckKey = null;
  const failAll = (error) => {
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.reject(error);
      pending.delete(id);
    }
  };
  const shake = handshake(transport, 'guest', bankFingerprint(), (message) => {
    fatal = clientError(message, 'p2p_mismatch', 409);
    failAll(fatal);
    errors.emit(fatal);
  });
  const offMessage = transport.onMessage((m) => {
    if (m?.t === 'poke') return pokes.emit('host');
    if (m?.t !== 'res') return;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.result);
    else p.reject(clientError(m.error?.message, m.error?.code, m.error?.status));
  });
  const offPeer = transport.onPeer((event) => {
    peers.emit(event);
    if (event === 'leave') failAll(clientError('Your friend’s browser disconnected.', 'p2p_disconnected', 503));
  });

  const send = (body) =>
    new Promise((resolve, reject) => {
      if (fatal) return reject(fatal);
      const id = next++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(clientError('No answer from your friend’s browser. Check the connection and retry.', 'p2p_timeout', 503));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      transport.send({ t: 'req', id, body: { ...body, token } });
    });

  const waitForHost = () =>
    new Promise((resolve, reject) => {
      if (fatal) return reject(fatal);
      if (shake.peer) return resolve(shake.peer);
      const timer = setTimeout(() => {
        off();
        offError();
        reject(clientError('Could not reach the host. Check the code and that your friend is waiting.', 'p2p_timeout', 503));
      }, timeoutMs);
      const off = shake.onReady((hello) => {
        clearTimeout(timer);
        off();
        offError();
        resolve(hello);
      });
      const offError = errors.on((error) => {
        clearTimeout(timer);
        off();
        offError();
        reject(error);
      });
    });

  return {
    role: 'guest',
    code: canonical,
    token,
    get peer() {
      return shake.peer;
    },
    /** Wait for the host, then take seat 1. Resolves with `{ room }`. */
    async join() {
      await waitForHost();
      keys = await roomKeys(canonical);
      return send({ action: 'join', invite: keys.invite, name });
    },
    /** The guest seat's `request()`: same bodies and results as lib/duel-client's. */
    request(body) {
      return send(body ?? {});
    },
    /** The deck this room deals for its config — the guest's own copy of the shared seed. After join(). */
    expectedDeck(config) {
      if (!keys) throw clientError('Join the room first.', 'not_ready', 409);
      const key = JSON.stringify(config);
      if (deckKey !== key) {
        deck = dealFromSeed(keys.seed, config);
        deckKey = key;
      }
      return deck;
    },
    /**
     * Whether the host dealt what the seed says: every question visible in `room` (the live round and
     * every completed one) matches the locally dealt card at its index, text and option order.
     */
    verify(room) {
      if (!room?.config) return true;
      const expected = this.expectedDeck(room.config);
      const same = (q, i) =>
        !q ||
        (!!expected[i] &&
          q.question === expected[i].question &&
          JSON.stringify(q.options) === JSON.stringify(expected[i].options));
      const done = (room.completedRounds ?? []).every((r) => same(r.question, r.index));
      return done && same(room.round?.question, room.roundIndex);
    },
    onPoke: pokes.on,
    onPeer: peers.on,
    onError: errors.on,
    async close() {
      failAll(clientError('The duel was closed.', 'p2p_closed', 503));
      shake.stop();
      offMessage();
      offPeer();
      await transport.close();
    },
  };
}
