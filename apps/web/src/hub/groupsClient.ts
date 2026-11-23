import type {
  GroupDetail,
  GroupShare,
  GroupShareKind,
  GroupStats,
  GroupSummary,
  MonthStats,
} from '@aske/shared/groups';
import { getDeviceKey } from '../groups/deviceKey';
import { hubFetch } from './client';

const seg = encodeURIComponent;

function groupFetch<T>(
  path: string,
  opts: { method?: string; json?: unknown; deviceKey?: string } = {},
): Promise<T> {
  const { deviceKey, ...rest } = opts;
  return hubFetch<T>(`/groups${path}`, {
    ...rest,
    headers: { 'X-Device-Key': deviceKey ?? getDeviceKey() },
  });
}

export async function listMyGroups(): Promise<GroupSummary[]> {
  return (await groupFetch<{ groups: GroupSummary[] }>('')).groups;
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
