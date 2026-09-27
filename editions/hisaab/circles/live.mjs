import { STORAGE } from '../../../lib/storage-names.mjs';
import { CIRCLE_LIMITS, validPresence, randomCircleId } from './model.mjs';

/** Short-lived presence only. No relay is used as a member/score database. */
export async function circleKeys(id, cryptoApi = globalThis.crypto) {
  if (!/^[a-f0-9]{32}$/.test(id) || !cryptoApi?.subtle) throw new Error('Use a secure browser to connect your circle.');
  const hash = async suffix => [...new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(`hisaab-circle/1:${id}:${suffix}`)))].map(n => n.toString(16).padStart(2, '0')).join('');
  return { topic: await hash('topic'), password: await hash('password') };
}

/** @param {{ circle: import('./types').Circle, xp?: number, via?: string, joinRoom?: Function, onState?: Function, now?: Function, heartbeatMs?: number, ttlMs?: number, Broadcast?: typeof BroadcastChannel }} options */
export async function createCircleSession({ circle, xp = 0, via = 'net', joinRoom, onState = (_state) => {}, now = Date.now,
  heartbeatMs = 10000, ttlMs = 35000, Broadcast = globalThis.BroadcastChannel } = {}) {
  const keys = await circleKeys(circle.id);
  let opened = true, room, channel, send, nickname = circle.nickname, score = xp;
  const connections = new Map(), peers = new Map(), lastMessages = new Map();
  const localSession = randomCircleId();
  const state = () => ({ status: peers.size ? 'connected' : 'listening', peers: [...peers.values()].map(({ seenAt, ...p }) => p) });
  const emit = () => { if (opened) onState(state()); };
  const presence = () => ({ v: 1, id: circle.memberId, nickname, xp: score });
  const receive = (data, peerId) => {
    if (!opened || typeof peerId !== 'string') return;
    const currentTime = now();
    if (currentTime - (lastMessages.get(peerId) ?? -Infinity) < 150) return;
    const p = validPresence(data);
    if (!p || p.id === circle.memberId) return;
    if (!connections.has(peerId) && connections.size >= CIRCLE_LIMITS.members) return;
    // A transport peer cannot claim another already-connected participant's identity.
    if ([...peers.entries()].some(([key, member]) => key !== peerId && member.id === p.id)) return;
    lastMessages.set(peerId, currentTime);
    connections.set(peerId, currentTime);
    peers.set(peerId, { ...p, seenAt: currentTime }); emit();
  };
  const peerJoin = peerId => {
    if (!opened || connections.size >= CIRCLE_LIMITS.members) return;
    connections.set(peerId, now()); send(presence(), peerId);
  };
  const peerLeave = peerId => { connections.delete(peerId); peers.delete(peerId); lastMessages.delete(peerId); emit(); };

  if (via === 'tab') {
    if (!Broadcast) throw new Error('This browser does not support local circle sessions.');
    channel = new Broadcast(`${STORAGE.circleChannel}${keys.topic}`);
    send = (data, target) => { if (opened) channel.postMessage({ from: localSession, target, data }); };
    channel.onmessage = ({ data: message }) => {
      if (!message || typeof message.from !== 'string' || message.from === localSession || (message.target && message.target !== localSession)) return;
      if (message.data?.bye) { peerLeave(message.from); return; }
      if (!connections.has(message.from)) peerJoin(message.from);
      receive(message.data, message.from);
    };
  } else {
    const join = joinRoom ?? (await import('trystero')).joinRoom;
    room = join({ appId: 'hisaab-do.circles.v1', password: keys.password }, keys.topic);
    const action = room.makeAction('presence');
    send = (data, target) => { if (opened) void action.send(data, target ? { target } : undefined).catch(() => {}); };
    room.onPeerJoin = peerJoin;
    room.onPeerLeave = peerLeave;
    action.onMessage = (data, context) => receive(data, context?.peerId);
  }
  const heartbeat = () => {
    if (!opened) return;
    let expired = false;
    for (const [id, seenAt] of connections) if (now() - seenAt > ttlMs) {
      peers.delete(id); connections.delete(id); lastMessages.delete(id); expired = true;
    }
    if (expired) emit();
    send(presence());
  };
  const timer = setInterval(heartbeat, heartbeatMs);
  emit(); heartbeat();
  return {
    snapshot: state,
    update({ nickname: nextNickname, xp: nextXp }) {
      const next = validPresence({ v: 1, id: circle.memberId, nickname: nextNickname ?? nickname, xp: nextXp ?? score });
      if (!next) return;
      nickname = next.nickname; score = next.xp; send(presence());
    },
    async close() {
      if (!opened) return;
      if (channel) { send({ bye: true }); channel.close(); }
      opened = false; clearInterval(timer); peers.clear(); connections.clear(); lastMessages.clear();
      if (room) await room.leave();
    },
  };
}
