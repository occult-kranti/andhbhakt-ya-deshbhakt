import { QUESTIONS } from './bank.mjs';
import { IMMEDIATE_DUEL_FEEDBACK } from '../edition-rules.mjs';
import { activeExpeditionById } from '../expeditions.mjs';
import { FIXTURE_KINDS, fixtureEventById, fixtureOpen, fixtureSet } from '../fixtures.mjs';
import { feeFor, prizeFor } from '../economy/economy.mjs';
import { escrowAccount, parseAccount, userAccount } from '../ledger/accounts.mjs';
import { settle as settleIntent, stake as stakeIntent } from '../ledger/intents.mjs';
import { sha256 } from '../ledger/sha256.mjs';
import { D1LedgerStore } from './ledger-store-d1.mjs';
import {
  RULES,
  GameError,
  requireValue,
  hashableToken,
  normalizeConfig,
  chooseDeck,
  makeRoom,
  readRoom,
  attachBot,
  readyPlayer,
  revealPlayer,
  answerPlayer,
  advance,
  settleMatch,
  projection,
} from './room-engine.mjs';
const encoder = new TextEncoder();
export async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function catalogue() {
  return {
    count: QUESTIONS.length,
    levels: ['simple', 'expert', 'extreme'],
    regions: ['US', 'India', 'Europe', 'Global'],
    topics: [...new Set(QUESTIONS.map((q) => q.topic))].map((topic) => ({
      topic,
      domain: QUESTIONS.find((q) => q.topic === topic).domain,
      count: QUESTIONS.filter((q) => q.topic === topic).length,
    })),
    facets: QUESTIONS.map(({ domain, topic, subtopic, region, difficulty }) => ({
      domain,
      topic,
      subtopic,
      region,
      difficulty,
    })),
    rules: { tieMs: RULES.tieMs, maxTransportMs: RULES.maxTransportMs },
    bankVersion: '2026-09-16-sports-329',
  };
}
const validId = (s) => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s);
const nameOf = (s) => {
  requireValue(typeof s === 'string', 'Enter a player name.');
  const name = s.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  requireValue(name.length > 0 && name.length <= 24, 'Enter a name up to 24 characters.');
  return name;
};
// -------------------------------------------------------------------------------------------
// Opt-in, anonymous cohort retention (`cohort-ping` / `cohort-report`).
//
// PRIVACY GUARANTEES — these are load-bearing, not aspirational:
//  1. `anonId` is a random 32-hex value minted on the device (lib/analytics.mjs) and kept only while
//     consent is 'granted'. It is not derived from, and cannot be joined to, any account, name,
//     email, device identifier, room token or IP address. The server never mints or assigns it.
//  2. Nothing personal is ever sent. The accepted payload is exactly: one anon id, one install day
//     key, and up to 40 entries of { day, sessions, ms, rounds, matches }. Every other property of
//     the body is ignored, and any unparsable entry rejects the whole call.
//  3. No IP address, user agent, header or actor hash is written by this code. `admit()` hashes an
//     actor for the shared per-minute rate limiter and stores only that short-lived counter key,
//     which is never associated with a cohort row.
//  4. `cohort-ping` answers `{ ok: true, stored: n }` and nothing else: the payload is never echoed
//     back, so the endpoint cannot be used to read another device's data back out.
//  5. `cohort-report` is aggregate-only. No query it runs can return an anon id or a per-device row,
//     and every bucket below COHORT.minBucket devices is reported as `null` with `suppressed: true`
//     rather than as a small, re-identifiable number.
//  6. Counters only ever rise (MAX upsert), so a replayed, reordered or stale ping can never lower a
//     total, and the server never needs to trust the order in which pings arrive.
export const COHORT = Object.freeze({
  /** Day entries accepted per call — also what keeps a ping inside the 4 KiB request cap. */
  maxDays: 40,
  /** Smallest number of devices a bucket may describe before it is suppressed. */
  minBucket: 5,
  /** Retention windows, in whole days after the install day. */
  windows: Object.freeze([1, 7, 30]),
  /** Sane per-day ceilings. A counter above these is clamped, not trusted and not rejected. */
  ceilings: Object.freeze({ sessions: 1000, ms: 86400000, rounds: 100000, matches: 100000 }),
});
const COHORT_FIELDS = Object.freeze(['sessions', 'ms', 'rounds', 'matches']);
const COHORT_NOTE =
  `Aggregate only, from devices that opted in. Buckets describing fewer than ${COHORT.minBucket} ` +
  'devices are suppressed. A window counts only devices whose day has fully elapsed, so the rates ' +
  'are not a projection; days are the device’s own local calendar days.';
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Integer day number for 'YYYY-MM-DD', or null when that is not a real calendar day. */
function dayNumber(iso) {
  const m = typeof iso === 'string' ? ISO_DAY.exec(iso) : null;
  if (!m) return null;
  const y = Number(m[1]),
    mo = Number(m[2]),
    d = Number(m[3]);
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  t.setUTCHours(0, 0, 0, 0);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== mo || t.getUTCDate() !== d) return null;
  return Math.round(t.getTime() / 864e5);
}
/** The server's own UTC day. Devices report local days, so the horizon below allows one day of slack. */
function serverDay(now) {
  requireValue(Number.isFinite(now), 'Invalid request.');
  return new Date(now).toISOString().slice(0, 10);
}
/**
 * Validates a `cohort-ping` body into exactly the columns the table holds. Hard rejections: a
 * non-hex id, an unreal calendar day, an empty or oversized day list, a duplicate day, a day before
 * the install day or beyond tomorrow, and any counter that is not a non-negative safe integer.
 * Counters above their ceiling are clamped rather than rejected, so an honest client with an odd
 * clock still reports, but no client can inflate the totals.
 */
export function readCohortPing(body, now) {
  requireValue(validId(body.anonId), 'Invalid measurement id.');
  const installNumber = dayNumber(body.installDay);
  requireValue(installNumber !== null, 'Invalid install day.');
  const list = body.days;
  requireValue(
    Array.isArray(list) && list.length > 0 && list.length <= COHORT.maxDays,
    `Send between 1 and ${COHORT.maxDays} days.`,
  );
  const horizon = dayNumber(serverDay(now)) + 1;
  const seen = new Set();
  const days = list.map((entry) => {
    requireValue(entry && typeof entry === 'object' && !Array.isArray(entry), 'Invalid day entry.');
    const number = dayNumber(entry.day);
    requireValue(number !== null, 'Invalid day.');
    requireValue(number >= installNumber, 'A day cannot precede the install day.');
    requireValue(number <= horizon, 'A day cannot be in the future.');
    requireValue(!seen.has(entry.day), 'Duplicate day.');
    seen.add(entry.day);
    const row = { day: entry.day };
    for (const field of COHORT_FIELDS) {
      const value = entry[field];
      requireValue(Number.isSafeInteger(value) && value >= 0, 'Counters must be whole and positive.');
      row[field] = Math.min(value, COHORT.ceilings[field]);
    }
    return row;
  });
  return { anonId: body.anonId, installDay: body.installDay, days };
}
/**
 * Shapes the raw aggregate into the response. Pure, so suppression is testable without a database.
 * Any bucket below COHORT.minBucket devices reads `null` with `suppressed: true` — never a small
 * number — and the lifetime sums are withheld until the whole cohort clears the same threshold,
 * because with one or two devices a sum IS that device's own data.
 */
export function shapeCohortReport(raw, today) {
  const small = (n) => !Number.isFinite(n) || n < COHORT.minBucket;
  const devices = Number(raw.devices) || 0;
  const quiet = small(devices);
  const retention = {};
  for (const n of COHORT.windows) {
    const w = raw.windows[`d${n}`] || { eligible: 0, returned: 0 };
    retention[`d${n}`] = small(w.eligible)
      ? Object.freeze({ eligible: null, returned: null, rate: null, suppressed: true })
      : Object.freeze({
          eligible: w.eligible,
          returned: w.returned,
          rate: Math.round((w.returned / w.eligible) * 1000) / 1000,
          suppressed: false,
        });
  }
  return Object.freeze({
    generatedDay: today,
    minBucket: COHORT.minBucket,
    devices,
    byInstallDay: Object.freeze(
      raw.byInstallDay.map((b) =>
        Object.freeze(
          small(b.devices)
            ? { day: b.day, devices: null, suppressed: true }
            : { day: b.day, devices: b.devices, suppressed: false },
        ),
      ),
    ),
    retention: Object.freeze(retention),
    sessions: quiet ? null : Number(raw.sessions) || 0,
    engagedHours: quiet ? null : Math.round((Number(raw.ms) || 0) / 36000) / 100,
    suppressed: quiet,
    note: COHORT_NOTE,
  });
}
// -------------------------------------------------------------------------------------------
// Entries and prizes on the real ledger.
//
// A store that carries a `ledger` (every `D1RoomStore`; a `MemoryRoomStore` only when a test hands
// it one) plays for real coins: the entry is a `stake` into the room's escrow account, posted when
// the seat is taken and BEFORE the room row is written, and the prize is one `settle` posted once
// the settled room is durable. A store without one keeps the demo: 1,000 simulated coins a seat,
// moved inside the room blob and never leaving it (lib/server/room-engine.mjs `makeRoom`).
//
// Why the order matters, twice over.
//  - Stake first, then write the seat. A seat that exists without its entry could start a match
//    for coins it never paid; an entry that exists without its seat is merely money in an escrow
//    the books can see. The write can fail after the stake landed (a lost revision race, a crash):
//    the retry finds the stake already posted (`duplicate`, treated as "already in"), and a join
//    that finally loses its seat to another guest releases its entry on the spot. Anything that
//    still slips through — a crash between the two — sits in the escrow account, is reported by
//    the reconciler as an open escrow, and is refunded by the room's final settlement, which pays
//    out of what the ledger says the escrow holds rather than what the room believes.
//  - Write the settled room first, then settle the ledger from THAT state. Two requests can settle
//    the same room in the same instant with different verdicts (a leave racing the second answer);
//    only one revision wins, and the payout must follow the winner. So the settle is derived from
//    the durable row, and every later read of a settled room that has not recorded `ledgerSettled`
//    posts it again — a `duplicate` is the ledger saying it already did. A crash between the two
//    writes is therefore healed by the next poll, or by the sweep before it deletes the room.
//
// Operation keys: `stake:<room>:<principal>` and `settle:<room>` — one entry per player per room,
// one payout per room — plus `release:<room>:<principal>` for an entry whose seat was lost.
// -------------------------------------------------------------------------------------------

/** The ledger a room store plays on, or null for the demo. */
export const ledgerFor = (store) => store?.ledger ?? null;

/** The key segment for a principal: the id itself when it fits, its hash when it would not. */
const opSegment = (principalId) =>
  /^[A-Za-z0-9_-]{1,64}$/.test(principalId) ? principalId : sha256(principalId).slice(0, 48);

/** Ledger timestamps must be positive; a test clock at zero still has to post. */
const at = (now) => Math.max(1, Math.floor(now));

/**
 * Post, absorbing a duplicate (already posted) and retrying a lost sequence race. Eight guests
 * staking into one escrow at the same instant lose that race up to seven times each, so the
 * budget is generous; past it the caller gets the same "busy, retry" the room itself answers.
 */
async function post(ledger, transaction) {
  for (let attempt = 0; ; attempt++) {
    try {
      await ledger.post(transaction);
      return 'posted';
    } catch (error) {
      if (error?.code === 'duplicate') return 'duplicate';
      if (error?.code === 'conflict' && attempt < 24) continue;
      if (error?.code === 'conflict') throw new GameError('The ledger is busy. Retrying is safe.', 503, 'room_busy');
      throw error;
    }
  }
}

/** The principals' balances, in seat order; 0 for a bot, an anonymous seat or an unopened account. */
export async function balanceSnapshot(ledger, principals) {
  const ids = principals.map((p) => (p ? userAccount('play', p) : null));
  const wanted = ids.filter(Boolean);
  const balances = wanted.length ? await ledger.balances(wanted) : new Map();
  return ids.map((id) => (id ? (balances.get(id) ?? 0) : 0));
}

/**
 * The entry for a seat. Refuses without a principal (401) or without the coins (400), and treats
 * an entry already in the escrow as paid, so a retried request is not charged twice.
 */
async function takeEntry(ledger, room, seat, principalId, now) {
  requireValue(principalId, 'Play for coins needs a guest or signed-in profile.', 401, 'sign_in_required');
  const amount = room.config.stake;
  const tx = stakeIntent({
    principalId,
    roomId: room.id,
    amount,
    opKey: `stake:${room.id}:${opSegment(principalId)}`,
    at: at(now),
  });
  try {
    await post(ledger, tx);
  } catch (error) {
    if (error?.code === 'overdraft') throw new GameError('Not enough coins for this entry.', 400, 'insufficient_coins');
    throw error;
  }
  room.principals[seat] = principalId;
  room.staked[seat] = true;
  room.escrow += amount;
}

/** An entry whose seat was lost goes straight back. An escrow already drained means it went back already. */
async function releaseEntry(ledger, room, principalId, now) {
  const tx = settleIntent({
    roomId: room.id,
    payouts: [{ principalId, amount: room.config.stake }],
    opKey: `release:${room.id}:${opSegment(principalId)}`,
    at: at(now),
    reason: 'entry released: the seat went to another player',
  });
  try {
    await post(ledger, tx);
  } catch (error) {
    if (error?.code !== 'overdraft') throw error;
  }
}

/**
 * What the escrow account holds, per principal, read from the ledger itself: every stake in,
 * less every release or settlement out. This — not the room's `staked` flags — is what the final
 * settlement pays out of, so an entry the room never seated still goes back to whoever paid it.
 */
export async function heldInEscrow(ledger, roomId) {
  const held = new Map();
  const entries = await ledger.entriesFor(escrowAccount(roomId), { limit: 1000 });
  for (const entry of entries) {
    const tx = await ledger.transaction(entry.txId);
    for (const leg of tx?.entries ?? []) {
      const meta = parseAccount(leg.account);
      if (meta.ledger === 'play' && meta.kind === 'user') held.set(meta.owner, (held.get(meta.owner) ?? 0) - leg.amount);
    }
  }
  for (const [principalId, amount] of held) if (amount <= 0) held.delete(principalId);
  return held;
}

/**
 * The one payout of a room, from its durable settled state. A completed match with a winner pays
 * the winner the tier's prize and burns the disclosed fee (prize + fee = the pot, exactly, which
 * `plan()` insists on). Everything else — a draw, a leave, a cancel, an expiry, a seat that never
 * filled — returns each entry whole. Idempotent: `settle:<room>` posts once, however often asked.
 */
export async function postSettlement(ledger, room, now) {
  for (let attempt = 0; ; attempt++) {
    const held = await heldInEscrow(ledger, room.id);
    if (held.size === 0) return { posted: false, payouts: [], fee: 0 };
    const stake = room.config.stake;
    const [p0, p1] = room.principals;
    const winnerId = room.winner === null ? null : room.principals[room.winner];
    const decided =
      room.reason === 'complete' &&
      !!winnerId &&
      p0 !== p1 &&
      held.size === 2 &&
      held.get(p0) === stake &&
      held.get(p1) === stake;
    const payouts = decided
      ? [{ principalId: winnerId, amount: prizeFor(stake) }]
      : [...held].map(([principalId, amount]) => ({ principalId, amount }));
    const fee = decided ? feeFor(stake) : 0;
    const tx = settleIntent({
      roomId: room.id,
      payouts,
      fee,
      opKey: `settle:${room.id}`,
      at: at(now),
      reason: decided ? `won by seat ${room.winner}` : `refund: ${room.reason ?? 'unsettled'}`,
    });
    try {
      const outcome = await post(ledger, tx);
      return { posted: outcome === 'posted', payouts, fee };
    } catch (error) {
      // A release landing between the read and the post changes what the escrow holds: read again.
      if (['conflict', 'overdraft'].includes(error?.code) && attempt < 5) continue;
      throw error;
    }
  }
}

/**
 * After a room is durable: if it has settled and the ledger has not, pay out, refresh the balance
 * snapshot and record that it landed. The record is a plain revision swap; losing it to a
 * concurrent poll only means that poll (or the next) repeats the idempotent payout and records it.
 */
async function finishLedger(store, ledger, roomId, revision, room, now) {
  if (!ledger || !room.ledger || !room.settled || room.ledgerSettled || !room.staked.some(Boolean))
    return { room, revision };
  await postSettlement(ledger, room, now);
  room.balances = await balanceSnapshot(ledger, room.principals);
  room.ledgerSettled = true;
  const saved = await store.compareSwap(roomId, revision, room);
  return { room, revision: saved ? revision + 1 : revision };
}

/**
 * The sweep's duty before it deletes an expired room: a room still holding entries is settled
 * here — by its own verdict if it reached one, as an expiry refund if it did not — so no deletion
 * can strand an escrow. True when a payout was posted.
 */
export async function settleExpiredRoom(ledger, room, now) {
  if (!ledger || !room.ledger || room.ledgerSettled || !room.staked.some(Boolean)) return false;
  if (!room.settled) settleMatch(room, null, 'room-expired', now);
  const { posted } = await postSettlement(ledger, room, now);
  return posted;
}

export class D1RoomStore {
  constructor(db) {
    this.db = typeof db.withSession === 'function' ? db.withSession('first-primary') : db;
    // The same session as the rooms, so an entry and the seat it pays for are one consistent view.
    this.ledger = new D1LedgerStore(this.db);
  }
  async clock() {
    return await this.db
      .prepare("SELECT CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AS db_now")
      .first();
  }
  async commitReveal(id, revision, room, seat, { databaseClock, now }) {
    const clockSql = databaseClock ? "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)" : '?';
    const bindings = databaseClock ? [] : [now];
    const botStamp =
      seat === 0 && room.players[1]?.kind === 'bot' ? ", '$.round.issuedAt[1]',(SELECT t FROM clock)" : '';
    return await this.db
      .prepare(
        `WITH clock(t) AS (SELECT ${clockSql}) UPDATE rooms SET state=json_set(?, '$.round.issuedAt[${seat}]',(SELECT t FROM clock)${botStamp}),revision=revision+1 WHERE id=? AND revision=? AND (SELECT t FROM clock)>=? AND (SELECT t FROM clock)<? RETURNING revision,state,expires_at`,
      )
      .bind(
        ...bindings,
        JSON.stringify(room),
        id,
        revision,
        room.round.scheduledAt,
        room.round.scheduledAt + RULES.showWindowMs,
      )
      .first();
  }
  async read(id) {
    return await this.db
      .prepare(
        "SELECT revision,state,expires_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AS db_now FROM rooms WHERE id=?",
      )
      .bind(id)
      .first();
  }
  async insert(room) {
    return (
      (
        await this.db
          .prepare('INSERT OR IGNORE INTO rooms (id,revision,state,expires_at,created_at) VALUES (?,0,?,?,?)')
          .bind(room.id, JSON.stringify(room), room.expiresAt, room.createdAt)
          .run()
      ).meta.changes === 1
    );
  }
  async compareSwap(id, revision, room) {
    return (
      (
        await this.db
          .prepare('UPDATE rooms SET state=?,revision=revision+1 WHERE id=? AND revision=?')
          .bind(JSON.stringify(room), id, revision)
          .run()
      ).meta.changes === 1
    );
  }
  // The answer's durable acceptance time is stamped inside the successful SQL write.
  async commitAttempt(id, revision, room, seat, { databaseClock, now }) {
    const a = room.round.answers[seat],
      issued = room.round.issuedAt[seat];
    const base = `$.round.answers[${seat}]`,
      clockSql = databaseClock ? "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)" : '?';
    const bindings = databaseClock ? [] : [now];
    const sql = `WITH clock(t) AS (SELECT ${clockSql}) UPDATE rooms SET state=json_set(?,
   '${base}.receivedAt',(SELECT t FROM clock),
   '${base}.serverElapsedMs',(SELECT t FROM clock)-?,
   '${base}.residualMs',(SELECT t FROM clock)-?-?,
   '${base}.timingOK',json(CASE WHEN (SELECT t FROM clock)-?-? BETWEEN -100 AND ? THEN 'true' ELSE 'false' END)),
   revision=revision+1 WHERE id=? AND revision=? AND (SELECT t FROM clock)<?
   RETURNING revision,state,expires_at`;
    return await this.db
      .prepare(sql)
      .bind(
        ...bindings,
        JSON.stringify(room),
        issued,
        issued,
        a.elapsedMs,
        issued,
        a.elapsedMs,
        a.graceMs,
        id,
        revision,
        issued + room.config.duration * 1000 + a.graceMs,
      )
      .first();
  }
  async admit(actor, now) {
    const bucket = Math.floor(now / 60000),
      key = `${actor}:${bucket}`;
    const row = await this.db
      .prepare(
        'INSERT INTO admission_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
      )
      .bind(key, (bucket + 2) * 60000)
      .first();
    requireValue(row.count <= 30, 'Too many room requests. Please wait a minute.', 429, 'rate_limited');
  }
  /**
   * One row per (anon id, day), counters raised and never lowered. `install_day` takes the earliest
   * value ever reported for the device so a re-installed or clock-skewed client cannot move a
   * cohort, and the whole ping is one batch so a partial write cannot leave a half-reported day.
   */
  async upsertCohortDays({ anonId, installDay, days }, now) {
    const sql = `INSERT INTO cohort_days (anon_id,install_day,day,sessions,ms,rounds,matches,updated_at)
   VALUES (?,?,?,?,?,?,?,?)
   ON CONFLICT(anon_id,day) DO UPDATE SET
   install_day=MIN(cohort_days.install_day,excluded.install_day),
   sessions=MAX(cohort_days.sessions,excluded.sessions),
   ms=MAX(cohort_days.ms,excluded.ms),
   rounds=MAX(cohort_days.rounds,excluded.rounds),
   matches=MAX(cohort_days.matches,excluded.matches),
   updated_at=MAX(cohort_days.updated_at,excluded.updated_at)`;
    await this.db.batch(
      days.map((d) =>
        this.db.prepare(sql).bind(anonId, installDay, d.day, d.sessions, d.ms, d.rounds, d.matches, now),
      ),
    );
    return days.length;
  }
  /**
   * The cohort aggregate. Every statement here collapses to a single row of counts: no query in this
   * method can return an anon id or a per-device row, by construction rather than by filtering.
   * A device's install day is the earliest it ever reported, and a window is only counted once the
   * target day is strictly behind the server's day — an unfinished window is never scored as a miss.
   */
  async readCohort(today) {
    const device = 'SELECT anon_id, MIN(install_day) AS install_day FROM cohort_days GROUP BY anon_id';
    const totals = await this.db
      .prepare(
        'SELECT COUNT(DISTINCT anon_id) AS devices, COALESCE(SUM(sessions),0) AS sessions, COALESCE(SUM(ms),0) AS ms FROM cohort_days',
      )
      .first();
    const buckets = await this.db
      .prepare(
        `SELECT json_group_array(json_object('day',install_day,'devices',devices)) AS rows FROM (SELECT install_day, COUNT(*) AS devices FROM (${device}) GROUP BY install_day ORDER BY install_day LIMIT 400)`,
      )
      .first();
    const hit = (n) =>
      `EXISTS(SELECT 1 FROM cohort_days c WHERE c.anon_id=d.anon_id AND c.day=date(d.install_day,'+${n} days'))`;
    const elapsed = (n) => `date(install_day,'+${n} days') < ?`;
    const marked = `SELECT d.install_day AS install_day, ${COHORT.windows.map((n) => `${hit(n)} AS r${n}`).join(', ')} FROM (${device}) d`;
    const columns = COHORT.windows
      .map(
        (n) =>
          `COALESCE(SUM(CASE WHEN ${elapsed(n)} THEN 1 ELSE 0 END),0) AS e${n}, COALESCE(SUM(CASE WHEN ${elapsed(n)} THEN r${n} ELSE 0 END),0) AS n${n}`,
      )
      .join(', ');
    const windows = await this.db
      .prepare(`SELECT ${columns} FROM (${marked})`)
      .bind(...COHORT.windows.flatMap(() => [today, today]))
      .first();
    return {
      devices: totals.devices,
      sessions: totals.sessions,
      ms: totals.ms,
      byInstallDay: JSON.parse(buckets?.rows ?? '[]'),
      windows: Object.fromEntries(
        COHORT.windows.map((n) => [`d${n}`, { eligible: windows[`e${n}`], returned: windows[`n${n}`] }]),
      ),
    };
  }
  /**
   * Bounded, like before: at most 100 expired rooms and 100 stale admission buckets a sweep. An
   * expired room still holding entries is settled on the ledger BEFORE its row goes (refund, or
   * its own verdict if it had one and the payout never landed); a room whose settlement fails is
   * kept for the next sweep rather than deleted with its escrow open, and the reconciler reports it.
   */
  async cleanup(now) {
    const expired = (await this.db.prepare('SELECT id,state FROM rooms WHERE expires_at < ? LIMIT 100').bind(now).all())
      .results;
    const gone = [];
    for (const row of expired) {
      try {
        await settleExpiredRoom(this.ledger, readRoom(row.state), now);
        gone.push(row.id);
      } catch {
        // Kept. The next sweep tries again; the open escrow is visible to the reconciler meanwhile.
      }
    }
    await this.db.batch([
      ...gone.map((id) => this.db.prepare('DELETE FROM rooms WHERE id=?').bind(id)),
      this.db
        .prepare(
          'DELETE FROM admission_limits WHERE key IN (SELECT key FROM admission_limits WHERE expires_at < ? LIMIT 100)',
        )
        .bind(now),
    ]);
  }
}
/**
 * @param {object | null} store A room store, or null for the storage-free actions.
 * @param {any} body The request body.
 * @param {{ now?: number, actor?: string, rng?: () => number, useDatabaseClock?: boolean, principalId?: string | null }} [options]
 *   `principalId` is who is asking (a guest id or a session's principal, resolved by the ingress);
 *   null is anonymous, which a free room accepts and an entry for coins refuses.
 */
export async function dispatch(
  store,
  body,
  { now = Date.now(), actor = 'local', rng = Math.random, useDatabaseClock = false, principalId = null } = {},
) {
  requireValue(body && typeof body === 'object' && !Array.isArray(body), 'Invalid request.');
  const action = body.action;
  if (action === 'catalogue') return { catalogue: catalogue(), serverNow: now };
  if (action === 'clock') return { serverNow: now };
  if (action === 'expedition') {
    // Only an expedition in an enabled domain is "available" — a hidden route is refused here with
    // the same message as an unknown one, so the client cannot tell hidden from nonexistent.
    const route = activeExpeditionById(body.routeId);
    requireValue(route, 'Choose an available expedition.');
    const cards = route.ids.map((id) => QUESTIONS.find((q) => q.id === id));
    requireValue(cards.every(Boolean), 'This expedition is temporarily unavailable.', 503);
    return {
      routeId: route.id,
      version: route.version,
      cards: cards.map((q) => {
        const order = [0, 1, 2, 3];
        for (let i = 3; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        return {
          factId: q.id,
          domain: q.domain,
          topic: q.topic,
          subtopic: q.subtopic,
          difficulty: q.difficulty,
          question: q.question,
          options: order.map((i) => q.options[i]),
          correctIndex: order.indexOf(q.correctIndex),
          explanation: q.explanation,
          sourceUrl: q.sourceUrl,
          sourceLabel: q.sourceLabel,
        };
      }),
      practice: true,
    };
  }
  if (action === 'fixture') {
    // A fixture set: the calendar entry must be visible, the kind known and its window open at the
    // `now` this service was given (in the player's local day — the offset travels with the body,
    // clamped to a real timezone). All three refusals share one message, exactly as a hidden
    // expedition shares the unknown route's, so a client cannot tell hidden from nonexistent.
    const event = fixtureEventById(body.eventId);
    const kind = body.kind;
    const tz = Number.isFinite(body.tzOffsetMinutes) ? Math.max(-840, Math.min(840, body.tzOffsetMinutes)) : 0;
    requireValue(
      event && FIXTURE_KINDS.includes(kind) && fixtureOpen(event, kind, now, { tzOffsetMinutes: tz }),
      'Choose an available fixture set.',
    );
    const ids = fixtureSet(event, QUESTIONS, { kind });
    const cards = ids.map((id) => QUESTIONS.find((q) => q.id === id));
    requireValue(cards.length > 0 && cards.every(Boolean), 'This fixture set is temporarily unavailable.', 503);
    return {
      eventId: event.id,
      kind,
      cards: cards.map((q) => {
        const order = [0, 1, 2, 3];
        for (let i = 3; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        return {
          factId: q.id,
          domain: q.domain,
          topic: q.topic,
          subtopic: q.subtopic,
          difficulty: q.difficulty,
          question: q.question,
          options: order.map((i) => q.options[i]),
          correctIndex: order.indexOf(q.correctIndex),
          explanation: q.explanation,
          sourceUrl: q.sourceUrl,
          sourceLabel: q.sourceLabel,
        };
      }),
      practice: true,
    };
  }
  if (action === 'practice') {
    const topic = body.topic ?? 'all';
    requireValue(
      typeof topic === 'string' && (topic === 'all' || QUESTIONS.some((q) => q.topic === topic)),
      'Choose an available practice topic.',
    );
    // Untimed teaching cards are intentionally open content, separate from sealed room attempts.
    const deck = chooseDeck(
      QUESTIONS,
      { mode: 'trilogy', domain: 'all', region: 'all', difficulty: 'all', subtopic: 'all', topic },
      rng,
    );
    return {
      cards: deck.map((q) => ({
        factId: q.id,
        domain: q.domain,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        sourceUrl: q.sourceUrl,
        sourceLabel: q.sourceLabel,
      })),
      practice: true,
    };
  }
  // Both cohort actions need the database, so neither is on the DB-less allowlist in
  // lib/server/http-handler.mjs: without `env.DB` the request never reaches here and answers 503.
  if (action === 'cohort-ping' || action === 'cohort-report') {
    // A store without the cohort table (the static build's in-memory one) says so honestly rather
    // than throwing: a cohort needs a shared server, and one browser tab is not one.
    requireValue(
      store && typeof store.upsertCohortDays === 'function',
      'The measurement service is unavailable.',
      503,
      'service_unavailable',
    );
    // The same per-minute admission counter as rooms: measurement gets no privileged quota.
    await store.admit(actor, now);
    const today = serverDay(now);
    if (action === 'cohort-report')
      return { cohort: shapeCohortReport(await store.readCohort(today), today) };
    // Nothing from the payload is echoed back — only how many day rows were accepted.
    return { ok: true, stored: await store.upsertCohortDays(readCohortPing(body, now), now) };
  }
  requireValue(validId(body.roomId), 'Invalid room link.');
  requireValue(hashableToken(body.token), 'Missing room access token.', 401, 'unauthorized');
  const tokenHash = await hash(body.token);
  const ledger = ledgerFor(store);
  const who = typeof principalId === 'string' && principalId.length > 0 && principalId.length <= 128 ? principalId : null;
  // Every answer carrying a room goes through here, so a settled room whose payout has not been
  // recorded is paid on whichever request sees it first — a poll, a retry, a re-create.
  const respond = async (room, seat, revision, when) => {
    const done = await finishLedger(store, ledger, body.roomId, revision, room, when);
    return { room: projection(done.room, seat, done.revision, when) };
  };
  if (action === 'create') {
    requireValue(hashableToken(body.invite), 'Invalid invitation.');
    const prior = await store.read(body.roomId);
    if (prior) {
      const r = readRoom(prior.state);
      requireValue(r.players[0].hash === tokenHash, 'Room unavailable.', 403);
      return respond(r, 0, prior.revision, now);
    }
    await store.admit(actor, now);
    const config = normalizeConfig(body.config, QUESTIONS);
    const r = makeRoom({
      id: body.roomId,
      hostHash: tokenHash,
      inviteHash: await hash(body.invite),
      name: nameOf(body.name),
      config,
      deck: chooseDeck(QUESTIONS, config, rng),
      now,
      principalId: who,
      ledger: !!ledger,
    });
    if (config.opponent === 'bot') attachBot(r, rng);
    if (ledger) {
      // The entry lands before the row does (see the ledger notes above). A bot room is free and
      // never touches the ledger at all.
      if (config.stake > 0) await takeEntry(ledger, r, 0, who, now);
      r.balances = await balanceSnapshot(ledger, r.principals);
    }
    const inserted = await store.insert(r);
    if (!inserted) {
      const row = await store.read(body.roomId);
      const existing = readRoom(row.state);
      if (existing.players[0].hash !== tokenHash) {
        // Someone else's room under this id. The entry just posted belongs to no seat: release it.
        if (ledger && config.stake > 0) await releaseEntry(ledger, r, who, now);
        throw new GameError('Room unavailable.', 403);
      }
      return respond(existing, 0, row.revision, now);
    }
    // Cleanup is bounded and only runs when a room is created, never on the answer path.
    await store.cleanup(now);
    return { room: projection(r, 0, 0, now) };
  }
  if (action === 'join') await store.admit(actor, now);
  for (let attempt = 0; attempt < RULES.maxRetries; attempt++) {
    const row = await store.read(body.roomId);
    requireValue(row, 'This room was not found or has expired.', 404, 'not_found');
    const room = readRoom(row.state);
    const eventNow = useDatabaseClock && Number.isFinite(row.db_now) ? row.db_now : now;
    if (action === 'join')
      requireValue(eventNow < room.expiresAt, 'This room has expired. Create a new one.', 410, 'expired');
    let seat = room.players.findIndex((p) => p?.hash === tokenHash);
    let changed = false;
    let newAnswer = false;
    let newReveal = false;
    if (action === 'join' && seat < 0) {
      requireValue(
        hashableToken(body.invite) && (await hash(body.invite)) === room.inviteHash,
        'The invitation is invalid.',
        403,
        'invalid_invite',
      );
      const paidEntry = ledger && room.ledger && room.config.stake > 0;
      if (!(room.phase === 'waiting' && !room.players[1])) {
        // The seat is gone. If an earlier attempt of this same join already paid its entry (the
        // write lost a revision race and a rival joined first), that entry goes back now.
        if (paidEntry && who) await releaseEntry(ledger, room, who, eventNow);
        throw new GameError('This room already has two players.', 409, 'room_full');
      }
      const name = nameOf(body.name);
      if (paidEntry) {
        requireValue(who, 'Play for coins needs a guest or signed-in profile.', 401, 'sign_in_required');
        requireValue(
          room.principals[0] !== who,
          'You are already in this room on another screen. Play for coins needs a second player.',
          409,
          'same_player',
        );
        await takeEntry(ledger, room, 1, who, eventNow);
      } else room.principals[1] = who;
      room.players[1] = { hash: tokenHash, name, ready: false, rttMs: 0, jitterMs: 0 };
      if (ledger && room.ledger) room.balances = await balanceSnapshot(ledger, room.principals);
      seat = 1;
      changed = true;
    }
    requireValue(seat >= 0, 'This screen is not a player in that room.', 403, 'unauthorized');
    const expired = advance(room, eventNow);
    changed = changed || expired;
    let deferredError = null;
    try {
      if (action === 'add_bot') {
      // Same rule as normalizeConfig, for the other door into a bot match: a staked friend room
      // cannot be converted into a staked bot match by seating a bot in the empty chair.
      requireValue(room.config.stake === 0, 'Practice bots play for free. Start a free room to add one.');
        requireValue(seat === 0, 'Only the room creator can add a bot.', 403);
        changed = attachBot(room, rng) || changed;
      } else if (action === 'ready') {
        requireValue(
          (body.roundId ?? null) === (room.round?.id ?? null),
          'That readiness signal is stale.',
          409,
          'stale_round',
        );
        changed = readyPlayer(room, seat, body, eventNow) || changed;
      } else if (action === 'reveal') {
        newReveal = revealPlayer(room, seat, body.roundId, eventNow);
        changed = newReveal || changed;
      } else if (action === 'answer') {
        newAnswer = answerPlayer(room, seat, body, eventNow);
        changed = newAnswer || changed;
      } else if (action === 'leave') changed = settleMatch(room, null, 'player-left', eventNow) || changed;
      else requireValue(['state', 'join'].includes(action), 'Unknown action.');
    } catch (e) {
      if (!expired) throw e;
      deferredError = e;
    }
    // A new answer is sealed before a later request can finalize the round.
    if (!newAnswer) changed = advance(room, eventNow) || changed;
    if (!changed) {
      if (deferredError) throw deferredError;
      return respond(room, seat, row.revision, eventNow);
    }
    if (newReveal) {
      const saved = await store.commitReveal(body.roomId, row.revision, room, seat, {
        databaseClock: useDatabaseClock,
        now: eventNow,
      });
      if (saved) {
        const durable = readRoom(saved.state);
        return respond(durable, seat, saved.revision, durable.round.issuedAt[seat]);
      }
      continue;
    }
    if (newAnswer) {
      const saved = await store.commitAttempt(body.roomId, row.revision, room, seat, {
        databaseClock: useDatabaseClock,
        now: eventNow,
      });
      if (saved) {
        const durable = readRoom(saved.state);
        const receivedAt = durable.round.answers[seat].receivedAt;
        // The attempt MUST be sealed first: commitAttempt stamps the real receipt time and
        // timing verdict. HISAAB then publishes any immediately decided round in this same
        // response instead of waiting for another poll. A race retries against the latest row;
        // it can neither overwrite another answer/leave nor settle the same match twice.
        if (IMMEDIATE_DUEL_FEEDBACK && advance(durable, receivedAt)) {
          if (await store.compareSwap(body.roomId, saved.revision, durable))
            return respond(durable, seat, saved.revision + 1, receivedAt);
          continue;
        }
        return respond(durable, seat, saved.revision, receivedAt);
      }
      continue;
    }
    if (await store.compareSwap(body.roomId, row.revision, room)) {
      if (deferredError) throw deferredError;
      return respond(room, seat, row.revision + 1, eventNow);
    }
  }
  throw new GameError('This room is busy. Retrying is safe.', 503, 'room_busy');
}
