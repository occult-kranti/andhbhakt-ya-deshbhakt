/**
 * lib/storage-names.mjs — every browser storage name the app uses, derived from one namespace.
 *
 * The prefixes come from lib/storage-ns.mjs, which an edition build aliases (see that file). Each
 * value below is what JHK has always used; tests/hisaab-storage.test.mjs pins the JHK values
 * byte for byte and proves the edition's differ. Add a name here, never as a literal at a call site.
 *
 * Pure and dependency-free apart from the namespace.
 */
import { STORAGE_NS } from './storage-ns.mjs';

/** The full name table for a namespace. Exported so a test can build an edition's table in node. */
export function storageNames({ long, short }) {
  return Object.freeze({
    // IndexedDB databases
    /** The player profile (lib/profile-store.mjs). */
    playerDb: `${long}-player`,
    /** The device coin wallet (lib/wallet-store.mjs). */
    walletDb: `${long}-wallet`,
    // BroadcastChannels
    /** Cross-tab "profile updated" pings (app/use-player.ts). */
    playerChannel: `${long}-player`,
    /** Cross-tab wallet pings (app/use-wallet.ts). */
    walletChannel: `${long}-wallet`,
    /** Prefix of same-device peer-to-peer duel channels (editions/hisaab/p2p). */
    p2pChannel: `${long}-p2p-`,
    /** Optional edition circles: live same-device rendezvous and local membership. */
    circleChannel: `${long}-circle-`,
    // localStorage
    /** The pre-IndexedDB journal, read once and migrated (app/use-player.ts). */
    legacyJournal: `${long}-journal-v1`,
    sound: `${long}-online-sound`,
    volume: `${long}-volume`,
    theme: `${long}-online-theme`,
    name: `${long}-name`,
    circles: `${long}-circles-v1`,
    /** Server guest credential and last room; never shared with other editions. */
    serverSession: `${long}-server-session-v1`,
    serverRoom: `${long}-server-room-v1`,
    haptics: `${long}-haptics`,
    motion: `${long}-motion`,
    art: `${long}-art`,
    /** The device guest id shared by the wallet, duel, auth and queue clients. */
    principal: `${short}-principal`,
    /** A wallet redeem nonce awaiting its retry (lib/wallet-client.ts). */
    pendingNonce: `${short}-pending-nonce`,
    locale: `${short}-locale`,
    /** The first-run profile gate record (lib/profile-gate.mjs). */
    gate: `${short}-gate`,
    /** The Home hero's one-time wake animation flag (components/three/hero-orb.tsx). */
    brainAwoke: `${short}.brain.awoke`,
    // sessionStorage
    /** The seat credentials of a live room, for reload recovery (app/arena.tsx). */
    onlineSeat: `${long}-online-seat`,
  });
}

/** This build's names. */
export const STORAGE = storageNames(STORAGE_NS);
