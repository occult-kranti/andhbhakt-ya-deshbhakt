export type CircleMember = { id: string; nickname: string; lastSeen: number };
export type Circle = { id: string; name: string; kind: 'friends' | 'family'; nickname: string; memberId: string; createdAt: number; members: CircleMember[] };
export type LivePeer = { id: string; nickname: string; xp: number };
export type CircleSnapshot = { circles: Circle[]; error: string };
