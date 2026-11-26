import {
  HUB_LIMITS,
  sanitizeHubSong,
  type HubErrorCode,
  type HubSong,
  type JamClientMessage,
  type JamItemView,
  type JamMember,
  type JamSnapshot,
} from '@aske/shared/hub';

export interface JamItem {
  id: string;
  song: HubSong;
  addedById: string;
  addedBy: string;
  addedAt: number;
  voterIds: string[];
}

export interface JamData {
  code: string;
  hostName: string;
  hostKeyHash: string;
  expiresAt: number;
  nowPlaying: JamItem | null;
  queue: JamItem[];
  /** Absent in Jams stored before remote skip existed. */
  skipRequested?: string | null;
}

export type ActionResult = { data: JamData } | { error: HubErrorCode };
/** Whether a connected host phone is able to carry out a skip. */
export type HostReadiness = 'ready' | 'outdated' | 'away';
export type SkipResult = ActionResult | { ignored: true };

/** Most votes first; ties go to whoever was added earlier. */
export function sortQueue(queue: readonly JamItem[]): JamItem[] {
  return [...queue].sort((a, b) => b.voterIds.length - a.voterIds.length || a.addedAt - b.addedAt);
}

function toView(item: JamItem, viewerId: string): JamItemView {
  return {
    id: item.id,
    song: item.song,
    addedBy: item.addedBy,
    votes: item.voterIds.length,
    votedByMe: item.voterIds.includes(viewerId),
    mine: item.addedById === viewerId,
    addedAt: item.addedAt,
  };
}

export function toSnapshot(
  data: JamData,
  members: JamMember[],
  viewerId: string,
  canSkip: boolean,
): JamSnapshot {
  return {
    code: data.code,
    hostName: data.hostName,
    expiresAt: data.expiresAt,
    nowPlaying: data.nowPlaying ? toView(data.nowPlaying, viewerId) : null,
    queue: sortQueue(data.queue).map((item) => toView(item, viewerId)),
    members: members.map(({ nickname, isHost }) => ({ nickname, isHost })),
    canSkip,
    skipRequested: data.skipRequested ?? null,
  };
}

function withQueue(data: JamData, queue: JamItem[]): ActionResult {
  return { data: { ...data, queue } };
}

function addSong(
  data: JamData,
  actor: JamMember,
  raw: unknown,
  now: number,
  newId: string,
): ActionResult {
  const song = sanitizeHubSong(raw);
  if (!song) return { error: 'invalid_request' };
  const same = data.queue.find((i) => i.song.videoId === song.videoId);
  if (same) {
    const voterIds = same.voterIds.includes(actor.memberId)
      ? same.voterIds
      : [...same.voterIds, actor.memberId];
    return withQueue(
      data,
      data.queue.map((i) => (i === same ? { ...i, voterIds } : i)),
    );
  }
  if (data.queue.length >= HUB_LIMITS.jamMaxQueue) return { error: 'queue_full' };
  const pending = data.queue.filter((i) => i.addedById === actor.memberId).length;
  if (pending >= HUB_LIMITS.jamMaxPendingPerMember) return { error: 'member_limit' };
  const item: JamItem = {
    id: newId,
    song,
    addedById: actor.memberId,
    addedBy: actor.nickname,
    addedAt: now,
    voterIds: [actor.memberId],
  };
  return withQueue(data, [...data.queue, item]);
}

function toggleVote(data: JamData, actor: JamMember, itemId: string): ActionResult {
  const target = data.queue.find((i) => i.id === itemId);
  if (!target) return { error: 'not_found' };
  const voted = target.voterIds.includes(actor.memberId);
  const voterIds = voted
    ? target.voterIds.filter((id) => id !== actor.memberId)
    : [...target.voterIds, actor.memberId];
  return withQueue(
    data,
    data.queue.map((i) => (i === target ? { ...i, voterIds } : i)),
  );
}

function removeItem(data: JamData, actor: JamMember, itemId: string): ActionResult {
  const target = data.queue.find((i) => i.id === itemId);
  if (!target) return { error: 'not_found' };
  if (!actor.isHost && target.addedById !== actor.memberId) return { error: 'not_host' };
  return withQueue(
    data,
    data.queue.filter((i) => i !== target),
  );
}

function startItem(data: JamData, itemId: string): ActionResult {
  const target = data.queue.find((i) => i.id === itemId);
  if (!target) return { error: 'not_found' };
  const queue = data.queue.filter((i) => i !== target);
  return { data: { ...data, nowPlaying: target, queue, skipRequested: null } };
}

function finishItem(data: JamData): ActionResult {
  return { data: { ...data, nowPlaying: null, skipRequested: null } };
}

/** Only records the wish: the host's phone does the actual skip with `start` or `finish`. */
export function requestSkip(
  data: JamData,
  itemId: string,
  ctx: { now: number; lastSkipAt?: number; host: HostReadiness },
): SkipResult {
  if (ctx.host !== 'ready') {
    return { error: ctx.host === 'outdated' ? 'host_outdated' : 'host_away' };
  }
  const tooSoon =
    ctx.lastSkipAt !== undefined && ctx.now - ctx.lastSkipAt < HUB_LIMITS.jamSkipEveryMs;
  const stale = data.nowPlaying?.id !== itemId || data.skipRequested === itemId;
  if (tooSoon || stale) return { ignored: true };
  return { data: { ...data, skipRequested: itemId } };
}

/** Pure state machine for the queue. 'end' only checks permission; the room closes itself. */
export function applyAction(
  data: JamData,
  actor: JamMember,
  msg: JamClientMessage,
  now: number,
  newId: string,
): ActionResult {
  switch (msg.type) {
    case 'add':
      return addSong(data, actor, msg.song, now, newId);
    case 'vote':
      return toggleVote(data, actor, msg.itemId);
    case 'remove':
      return removeItem(data, actor, msg.itemId);
    case 'start':
      return actor.isHost ? startItem(data, msg.itemId) : { error: 'not_host' };
    case 'finish':
      return actor.isHost ? finishItem(data) : { error: 'not_host' };
    case 'end':
      return actor.isHost ? { data } : { error: 'not_host' };
    default:
      return { error: 'invalid_request' };
  }
}
