import {
  GROUP_LIMITS,
  type GroupDetail,
  type GroupMember,
  type GroupSummary,
} from '@aske/shared/groups';
import type { HubErrorCode } from '@aske/shared/hub';
import { randomCode } from '../lib/ids';
import { HubHttpError } from '../lib/http';
import type { GroupRepo, GroupRow, MemberRow } from './repo';

const ATTEMPTS = 5;

const fail = (status: 403 | 404 | 409, code: HubErrorCode, message: string) =>
  new HubHttpError(status, code, message);

export function toDetail(group: GroupRow, members: MemberRow[], you: string): GroupDetail {
  const list: GroupMember[] = members.map((m) => ({
    memberId: m.memberId,
    alias: m.alias,
    isOwner: m.memberId === group.ownerMemberId,
    joinedAt: m.joinedAt,
  }));
  return {
    id: group.id,
    name: group.name,
    inviteCode: group.inviteCode,
    isOwner: you === group.ownerMemberId,
    you,
    members: list,
  };
}

export async function listSummaries(repo: GroupRepo, deviceHash: string): Promise<GroupSummary[]> {
  const mine = await repo.groupsOfDevice(deviceHash);
  return mine.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    members: m.members,
    isOwner: m.memberId === m.group.ownerMemberId,
  }));
}

async function assertRoomForAnotherGroup(repo: GroupRepo, deviceHash: string): Promise<void> {
  const mine = await repo.groupsOfDevice(deviceHash);
  if (mine.length >= GROUP_LIMITS.maxGroupsPerDevice) {
    throw fail(409, 'too_many_groups', 'You are already in too many groups');
  }
}

export async function createGroup(
  repo: GroupRepo,
  deviceHash: string,
  name: string,
  alias: string,
  now: number,
): Promise<GroupDetail> {
  await assertRoomForAnotherGroup(repo, deviceHash);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const memberId = randomCode(GROUP_LIMITS.memberIdLength);
    const group: GroupRow = {
      id: randomCode(GROUP_LIMITS.groupIdLength),
      name,
      inviteCode: randomCode(GROUP_LIMITS.inviteCodeLength),
      ownerMemberId: memberId,
      createdAt: now,
      lastActiveAt: now,
    };
    const owner: MemberRow = { groupId: group.id, memberId, deviceHash, alias, joinedAt: now };
    if (await repo.createGroup(group, owner)) return toDetail(group, [owner], memberId);
  }
  throw new HubHttpError(500, 'internal_error', 'Could not create the group');
}

async function addNewMember(
  repo: GroupRepo,
  group: GroupRow,
  members: MemberRow[],
  deviceHash: string,
  alias: string,
  now: number,
): Promise<MemberRow> {
  if (await repo.isBanned(group.id, deviceHash)) {
    throw fail(403, 'kicked', 'You were removed from this group');
  }
  if (members.length >= GROUP_LIMITS.maxMembers) {
    throw fail(409, 'group_full', 'This group is full');
  }
  await assertRoomForAnotherGroup(repo, deviceHash);
  const taken = new Set(members.map((m) => m.memberId));
  let memberId = randomCode(GROUP_LIMITS.memberIdLength);
  while (taken.has(memberId)) memberId = randomCode(GROUP_LIMITS.memberIdLength);
  const member: MemberRow = { groupId: group.id, memberId, deviceHash, alias, joinedAt: now };
  await repo.addMember(member);
  return member;
}

/** Joins by invite code; someone already inside just updates their alias. */
export async function joinGroup(
  repo: GroupRepo,
  deviceHash: string,
  inviteCode: string,
  alias: string,
  now: number,
): Promise<GroupDetail> {
  const group = await repo.findGroupByInvite(inviteCode);
  if (!group) throw fail(404, 'group_not_found', 'That invitation does not exist');
  const members = await repo.listMembers(group.id);
  const existing = members.find((m) => m.deviceHash === deviceHash);
  if (existing) {
    await repo.updateAlias(group.id, existing.memberId, alias);
    existing.alias = alias;
    return toDetail(group, members, existing.memberId);
  }
  const added = await addNewMember(repo, group, members, deviceHash, alias, now);
  await repo.touchGroup(group.id, now);
  return toDetail(group, [...members, added], added.memberId);
}

export async function renewInvite(repo: GroupRepo, groupId: string, now: number): Promise<string> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const code = randomCode(GROUP_LIMITS.inviteCodeLength);
    if (await repo.setInviteCode(groupId, code)) {
      await repo.touchGroup(groupId, now);
      return code;
    }
  }
  throw new HubHttpError(500, 'internal_error', 'Could not renew the invitation');
}

/** Removes a member; the oldest one inherits the group and an empty group disappears. */
export async function leaveGroup(
  repo: GroupRepo,
  group: GroupRow,
  memberId: string,
  now: number,
): Promise<void> {
  await repo.removeMember(group.id, memberId);
  const [oldest] = await repo.listMembers(group.id);
  if (!oldest) {
    await repo.deleteGroup(group.id);
    return;
  }
  if (group.ownerMemberId === memberId) await repo.setOwner(group.id, oldest.memberId);
  await repo.touchGroup(group.id, now);
}

/** Removes someone else and bans their device from this group. */
export async function kickMember(
  repo: GroupRepo,
  group: GroupRow,
  target: MemberRow,
  now: number,
): Promise<void> {
  await repo.ban(group.id, target.deviceHash);
  await leaveGroup(repo, group, target.memberId, now);
}

/** "Delete all my group data": leaves every group and drops the stats. */
export async function leaveAll(repo: GroupRepo, deviceHash: string, now: number): Promise<void> {
  for (const { group, memberId } of await repo.groupsOfDevice(deviceHash)) {
    await leaveGroup(repo, group, memberId, now);
  }
  await repo.deleteStats(deviceHash);
}
