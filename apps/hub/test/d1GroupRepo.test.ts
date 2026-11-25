import { beforeEach, describe, expect, it } from 'vitest';
import { D1GroupRepo, type GroupRow, type MemberRow, type ShareRow } from '../src/groups/repo';
import { createTestD1, type SqliteD1 } from './sqliteD1';

const group = (n: number, patch: Partial<GroupRow> = {}): GroupRow => ({
  id: `g${n}`,
  name: `Group ${n}`,
  inviteCode: `CODE${n}`,
  ownerMemberId: `m${n}`,
  createdAt: 1000 + n,
  lastActiveAt: 1000 + n,
  ...patch,
});

const member = (groupId: string, n: number, patch: Partial<MemberRow> = {}): MemberRow => ({
  groupId,
  memberId: `m${n}`,
  deviceHash: `dev${n}`,
  alias: `Alias ${n}`,
  joinedAt: 2000 + n,
  ...patch,
});

const share = (n: number, patch: Partial<ShareRow> = {}): ShareRow => ({
  id: `s${n}`,
  groupId: 'g1',
  memberId: 'm1',
  kind: 'list',
  ref: `ref${n}`,
  title: `Share ${n}`,
  createdAt: 3000 + n,
  expiresAt: 9000,
  ...patch,
});

let sql: SqliteD1;
let repo: D1GroupRepo;

const count = (table: string) =>
  sql.rows<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n ?? 0;

beforeEach(async () => {
  sql = createTestD1();
  repo = new D1GroupRepo(sql as unknown as D1Database);
  await repo.createGroup(group(1), member('g1', 1));
});

describe('groups', () => {
  it('creates a group with its owner and finds it by id', async () => {
    expect(await repo.findGroup('g1')).toEqual(group(1));
    expect(await repo.listMembers('g1')).toEqual([member('g1', 1)]);
  });

  it('returns null for an unknown group', async () => {
    expect(await repo.findGroup('nope')).toBeNull();
  });

  it('finds a group by its invite code', async () => {
    expect((await repo.findGroupByInvite('CODE1'))?.id).toBe('g1');
    expect(await repo.findGroupByInvite('OTHER')).toBeNull();
  });

  it('changes the owner and the last activity', async () => {
    await repo.setOwner('g1', 'm9');
    await repo.touchGroup('g1', 5555);
    expect(await repo.findGroup('g1')).toMatchObject({ ownerMemberId: 'm9', lastActiveAt: 5555 });
  });

  it('lists the groups of a device with their member count, oldest first', async () => {
    await repo.createGroup(group(2), member('g2', 2, { deviceHash: 'dev1' }));
    await repo.addMember(member('g2', 3));
    const list = await repo.groupsOfDevice('dev1');
    expect(list.map((x) => [x.group.id, x.memberId, x.members])).toEqual([
      ['g1', 'm1', 1],
      ['g2', 'm2', 2],
    ]);
    expect(await repo.groupsOfDevice('stranger')).toEqual([]);
  });
});

describe('invite code', () => {
  it('replaces the invite code', async () => {
    expect(await repo.setInviteCode('g1', 'NEW')).toBe(true);
    expect((await repo.findGroupByInvite('NEW'))?.id).toBe('g1');
    expect(await repo.findGroupByInvite('CODE1')).toBeNull();
  });

  it('refuses a code that another group already uses', async () => {
    await repo.createGroup(group(2), member('g2', 2));
    expect(await repo.setInviteCode('g2', 'CODE1')).toBe(false);
    expect((await repo.findGroup('g2'))?.inviteCode).toBe('CODE2');
  });

  it('createGroup returns false on a repeated code and leaves no half-made rows', async () => {
    const clash = group(2, { inviteCode: 'CODE1' });
    expect(await repo.createGroup(clash, member('g2', 2))).toBe(false);
    expect(await repo.findGroup('g2')).toBeNull();
    expect(await repo.listMembers('g2')).toEqual([]);
    expect(count('groups')).toBe(1);
    expect(count('group_members')).toBe(1);
  });

  it('createGroup returns false on a repeated id', async () => {
    expect(await repo.createGroup(group(1, { inviteCode: 'X' }), member('g1', 5))).toBe(false);
  });
});

describe('members', () => {
  it('lists members oldest first', async () => {
    await repo.addMember(member('g1', 3, { joinedAt: 1 }));
    await repo.addMember(member('g1', 2));
    expect((await repo.listMembers('g1')).map((m) => m.memberId)).toEqual(['m3', 'm1', 'm2']);
  });

  it('finds a member by device', async () => {
    expect((await repo.findMemberByDevice('g1', 'dev1'))?.memberId).toBe('m1');
    expect(await repo.findMemberByDevice('g1', 'ghost')).toBeNull();
  });

  it('does not allow the same device twice in a group', async () => {
    await expect(repo.addMember(member('g1', 2, { deviceHash: 'dev1' }))).rejects.toThrow();
  });

  it('updates an alias', async () => {
    await repo.updateAlias('g1', 'm1', 'Renamed');
    expect((await repo.findMemberByDevice('g1', 'dev1'))?.alias).toBe('Renamed');
  });

  it('removes a member together with their shares', async () => {
    await repo.addMember(member('g1', 2));
    await repo.addShare(share(1));
    await repo.addShare(share(2, { memberId: 'm2' }));
    await repo.removeMember('g1', 'm2');
    expect((await repo.listMembers('g1')).map((m) => m.memberId)).toEqual(['m1']);
    expect((await repo.listShares('g1', 0)).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('bans', () => {
  it('bans a device and tolerates banning it twice', async () => {
    expect(await repo.isBanned('g1', 'dev9')).toBe(false);
    await repo.ban('g1', 'dev9');
    await repo.ban('g1', 'dev9');
    expect(await repo.isBanned('g1', 'dev9')).toBe(true);
    expect(await repo.isBanned('g2', 'dev9')).toBe(false);
  });
});

describe('stats', () => {
  it('stores one row per device and month, and overwrites it', async () => {
    await repo.putStats('dev1', '2026-05', '{"a":1}', 10);
    await repo.putStats('dev1', '2026-05', '{"a":2}', 20);
    const rows = await repo.statsForGroup('g1', '2026-05');
    expect(rows).toEqual([{ memberId: 'm1', alias: 'Alias 1', statsJson: '{"a":2}' }]);
    expect(count('device_stats')).toBe(1);
  });

  it('returns only the asked month, for members of the group, oldest member first', async () => {
    await repo.addMember(member('g1', 2));
    await repo.putStats('dev2', '2026-05', 'two', 1);
    await repo.putStats('dev1', '2026-05', 'one', 1);
    await repo.putStats('dev1', '2026-04', 'old', 1);
    await repo.putStats('outsider', '2026-05', 'out', 1);
    const rows = await repo.statsForGroup('g1', '2026-05');
    expect(rows.map((r) => r.statsJson)).toEqual(['one', 'two']);
  });

  it('deletes every month of a device', async () => {
    await repo.putStats('dev1', '2026-04', 'a', 1);
    await repo.putStats('dev1', '2026-05', 'b', 1);
    await repo.putStats('dev2', '2026-05', 'c', 1);
    await repo.deleteStats('dev1');
    expect(count('device_stats')).toBe(1);
  });
});

describe('shares', () => {
  it('lists only unexpired shares, newest first', async () => {
    await repo.addShare(share(1));
    await repo.addShare(share(2));
    await repo.addShare(share(3, { expiresAt: 100 }));
    expect((await repo.listShares('g1', 500)).map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('finds and deletes a share', async () => {
    await repo.addShare(share(1));
    expect(await repo.findShare('g1', 's1')).toEqual(share(1));
    expect(await repo.findShare('g2', 's1')).toBeNull();
    await repo.deleteShare('s1');
    expect(await repo.findShare('g1', 's1')).toBeNull();
  });

  it('keeps only the newest shares of one group when trimming', async () => {
    for (const n of [1, 2, 3, 4]) await repo.addShare(share(n));
    await repo.createGroup(group(2), member('g2', 2));
    await repo.addShare(share(9, { groupId: 'g2' }));
    await repo.trimShares('g1', 2);
    expect((await repo.listShares('g1', 0)).map((s) => s.id)).toEqual(['s4', 's3']);
    expect((await repo.listShares('g2', 0)).map((s) => s.id)).toEqual(['s9']);
  });

  it('reads the expiry of a shared list, or null when it does not exist', async () => {
    await sql
      .prepare(
        `INSERT INTO shared_lists (id, name, songs_json, delete_key_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind('l1', 'n', '[]', 'h', 1, 777)
      .run();
    expect(await repo.listExpiry('l1')).toBe(777);
    expect(await repo.listExpiry('nope')).toBeNull();
  });
});

describe('deleteGroup', () => {
  it('removes the group and everything that hangs from it, and nothing else', async () => {
    await repo.createGroup(group(2), member('g2', 2));
    await repo.addShare(share(1));
    await repo.ban('g1', 'dev9');
    await repo.ban('g2', 'dev9');
    await repo.deleteGroup('g1');
    expect(await repo.findGroup('g1')).toBeNull();
    expect(await repo.listMembers('g1')).toEqual([]);
    expect(await repo.listShares('g1', 0)).toEqual([]);
    expect(await repo.isBanned('g1', 'dev9')).toBe(false);
    expect(await repo.findGroup('g2')).not.toBeNull();
    expect(await repo.isBanned('g2', 'dev9')).toBe(true);
  });
});
