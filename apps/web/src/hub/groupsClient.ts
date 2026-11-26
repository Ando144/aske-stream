import type {
  GroupDetail,
  GroupPreview,
  GroupShare,
  GroupShareKind,
  GroupStats,
  GroupSummary,
  MonthStats,
} from '@aske/shared/groups';
import { getDeviceKey } from '../groups/deviceKey';
import { hubFetch, hubFetchBlob } from './client';

const seg = encodeURIComponent;

interface GroupRequest {
  method?: string;
  json?: unknown;
  body?: Blob;
  deviceKey?: string;
}

function withDeviceKey({ deviceKey, ...rest }: GroupRequest) {
  return { ...rest, headers: { 'X-Device-Key': deviceKey ?? getDeviceKey() } };
}

function groupFetch<T>(path: string, opts: GroupRequest = {}): Promise<T> {
  return hubFetch<T>(`/groups${path}`, withDeviceKey(opts));
}

function groupFetchBlob(path: string, opts: GroupRequest = {}): Promise<Blob | null> {
  return hubFetchBlob(`/groups${path}`, withDeviceKey(opts));
}

/** `month` is the phone's local 'YYYY-MM', used for the summary on each card. */
export async function listMyGroups(month?: string): Promise<GroupSummary[]> {
  const query = month ? `?month=${seg(month)}` : '';
  return (await groupFetch<{ groups: GroupSummary[] }>(query)).groups;
}

export function renameGroup(id: string, name: string): Promise<GroupDetail> {
  return groupFetch(`/${seg(id)}/name`, { method: 'PUT', json: { name } });
}

export function uploadGroupPhoto(id: string, jpeg: Blob): Promise<{ photoAt: number }> {
  return groupFetch(`/${seg(id)}/photo`, { method: 'PUT', body: jpeg });
}

export function deleteGroupPhoto(id: string): Promise<void> {
  return groupFetch(`/${seg(id)}/photo`, { method: 'DELETE' });
}

export function fetchGroupPhoto(id: string): Promise<Blob | null> {
  return groupFetchBlob(`/${seg(id)}/photo`);
}

// POST so that the invite code never ends up in a URL.
export function peekGroup(code: string): Promise<GroupPreview> {
  return groupFetch('/peek', { method: 'POST', json: { code } });
}

export function fetchInvitePhoto(code: string): Promise<Blob | null> {
  return groupFetchBlob('/peek/photo', { method: 'POST', json: { code } });
}

export function createGroup(name: string, alias: string): Promise<GroupDetail> {
  return groupFetch('', { method: 'POST', json: { name, alias } });
}

export function joinGroup(code: string, alias: string): Promise<GroupDetail> {
  return groupFetch('/join', { method: 'POST', json: { code, alias } });
}

export function getGroup(id: string): Promise<GroupDetail> {
  return groupFetch(`/${seg(id)}`);
}

export async function renewInvite(id: string): Promise<string> {
  const res = await groupFetch<{ inviteCode: string }>(`/${seg(id)}/invite`, { method: 'POST' });
  return res.inviteCode;
}

export function removeMember(id: string, memberId: string): Promise<void> {
  return groupFetch(`/${seg(id)}/members/${seg(memberId)}`, { method: 'DELETE' });
}

export function deleteMyGroupData(): Promise<void> {
  return groupFetch('/me', { method: 'DELETE' });
}

/** `deviceKey` lets a caller wipe the stats stored under a key that was just replaced. */
export function deleteMyStats(deviceKey?: string): Promise<void> {
  return groupFetch('/stats', { method: 'DELETE', deviceKey });
}

export function uploadStats(months: MonthStats[]): Promise<void> {
  return groupFetch('/stats', { method: 'PUT', json: { months } });
}

export function getGroupStats(id: string, month: string): Promise<GroupStats> {
  return groupFetch(`/${seg(id)}/stats?month=${seg(month)}`);
}

export async function listShares(id: string): Promise<GroupShare[]> {
  return (await groupFetch<{ shares: GroupShare[] }>(`/${seg(id)}/shares`)).shares;
}

export function addShare(
  id: string,
  share: { kind: GroupShareKind; ref: string; title: string },
): Promise<GroupShare> {
  return groupFetch(`/${seg(id)}/shares`, { method: 'POST', json: share });
}

export function deleteShare(id: string, shareId: string): Promise<void> {
  return groupFetch(`/${seg(id)}/shares/${seg(shareId)}`, { method: 'DELETE' });
}
