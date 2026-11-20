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
}

export type ActionResult = { data: JamData } | { error: HubErrorCode };

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

export function toSnapshot(data: JamData, members: JamMember[], viewerId: string): JamSnapshot {
  return {
    code: data.code,
    hostName: data.hostName,
    expiresAt: data.expiresAt,
    nowPlaying: data.nowPlaying ? toView(data.nowPlaying, viewerId) : null,
    queue: sortQueue(data.queue).map((item) => toView(item, viewerId)),
    members: members.map(({ nickname, isHost }) => ({ nickname, isHost })),
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
  return { data: { ...data, nowPlaying: target, queue: data.queue.filter((i) => i !== target) } };
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
      return actor.isHost ? { data: { ...data, nowPlaying: null } } : { error: 'not_host' };
    case 'end':
      return actor.isHost ? { data } : { error: 'not_host' };
    default:
      return { error: 'invalid_request' };
  }
}
