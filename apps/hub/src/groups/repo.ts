import type { GroupShareKind } from '@aske/shared/groups';

export interface GroupRow {
  id: string;
  name: string;
  inviteCode: string;
  ownerMemberId: string;
  createdAt: number;
  lastActiveAt: number;
}
export interface MemberRow {
  groupId: string;
  memberId: string;
  deviceHash: string;
  alias: string;
  joinedAt: number;
}
export interface ShareRow {
  id: string;
  groupId: string;
  memberId: string;
  kind: GroupShareKind;
  ref: string;
  title: string;
  createdAt: number;
  expiresAt: number;
}

export interface GroupRepo {
  /** false when the id or the invite code collides. */
  createGroup(group: GroupRow, owner: MemberRow): Promise<boolean>;
  findGroup(id: string): Promise<GroupRow | null>;
  findGroupByInvite(code: string): Promise<GroupRow | null>;
  /** false when the code collides. */
  setInviteCode(groupId: string, code: string): Promise<boolean>;
  setOwner(groupId: string, memberId: string): Promise<void>;
  touchGroup(groupId: string, now: number): Promise<void>;
  /** Also removes members, bans and shares. */
  deleteGroup(groupId: string): Promise<void>;
  /** Oldest first. */
  listMembers(groupId: string): Promise<MemberRow[]>;
  findMemberByDevice(groupId: string, deviceHash: string): Promise<MemberRow | null>;
  groupsOfDevice(
    deviceHash: string,
  ): Promise<Array<{ group: GroupRow; memberId: string; members: number }>>;
  addMember(member: MemberRow): Promise<void>;
  updateAlias(groupId: string, memberId: string, alias: string): Promise<void>;
  /** Also removes the member's shares. */
  removeMember(groupId: string, memberId: string): Promise<void>;
  isBanned(groupId: string, deviceHash: string): Promise<boolean>;
  ban(groupId: string, deviceHash: string): Promise<void>;
  putStats(deviceHash: string, month: string, statsJson: string, now: number): Promise<void>;
  deleteStats(deviceHash: string): Promise<void>;
  statsForGroup(
    groupId: string,
    month: string,
  ): Promise<Array<{ memberId: string; alias: string; statsJson: string }>>;
  /** expires_at of a shared list, or null when it does not exist. */
  listExpiry(listId: string): Promise<number | null>;
  addShare(share: ShareRow): Promise<void>;
  /** Not expired, newest first. */
  listShares(groupId: string, now: number): Promise<ShareRow[]>;
  findShare(groupId: string, shareId: string): Promise<ShareRow | null>;
  deleteShare(shareId: string): Promise<void>;
  /** Keeps only the `keep` newest shares. */
  trimShares(groupId: string, keep: number): Promise<void>;
}

interface GroupDbRow {
  id: string;
  name: string;
  invite_code: string;
  owner_member_id: string;
  created_at: number;
  last_active_at: number;
}
interface MemberDbRow {
  group_id: string;
  member_id: string;
  device_hash: string;
  alias: string;
  joined_at: number;
}
interface ShareDbRow {
  id: string;
  group_id: string;
  member_id: string;
  kind: string;
  ref: string;
  title: string;
  created_at: number;
  expires_at: number;
}

const toGroup = (r: GroupDbRow): GroupRow => ({
  id: r.id,
  name: r.name,
  inviteCode: r.invite_code,
  ownerMemberId: r.owner_member_id,
  createdAt: r.created_at,
  lastActiveAt: r.last_active_at,
});
const toMember = (r: MemberDbRow): MemberRow => ({
  groupId: r.group_id,
  memberId: r.member_id,
  deviceHash: r.device_hash,
  alias: r.alias,
  joinedAt: r.joined_at,
});
const toShare = (r: ShareDbRow): ShareRow => ({
  id: r.id,
  groupId: r.group_id,
  memberId: r.member_id,
  kind: r.kind as GroupShareKind,
  ref: r.ref,
  title: r.title,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

const isUniqueViolation = (err: unknown) => /UNIQUE|constraint/i.test(String(err));

export class D1GroupRepo implements GroupRepo {
  constructor(private readonly db: D1Database) {}

  private run(sql: string, ...params: unknown[]): Promise<D1Response> {
    return this.db
      .prepare(sql)
      .bind(...params)
      .run();
  }

  private first<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return this.db
      .prepare(sql)
      .bind(...params)
      .first<T>();
  }

  private async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const res = await this.db
      .prepare(sql)
      .bind(...params)
      .all<T>();
    return res.results;
  }

  async createGroup(g: GroupRow, owner: MemberRow): Promise<boolean> {
    try {
      await this.db.batch([
        this.db
          .prepare(
            'INSERT INTO groups (id, name, invite_code, owner_member_id, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(g.id, g.name, g.inviteCode, g.ownerMemberId, g.createdAt, g.lastActiveAt),
        this.insertMember(owner),
      ]);
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  async findGroup(id: string): Promise<GroupRow | null> {
    const row = await this.first<GroupDbRow>('SELECT * FROM groups WHERE id = ?', id);
    return row ? toGroup(row) : null;
  }

  async findGroupByInvite(code: string): Promise<GroupRow | null> {
    const row = await this.first<GroupDbRow>('SELECT * FROM groups WHERE invite_code = ?', code);
    return row ? toGroup(row) : null;
  }

  async setInviteCode(groupId: string, code: string): Promise<boolean> {
    try {
      await this.run('UPDATE groups SET invite_code = ? WHERE id = ?', code, groupId);
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  async setOwner(groupId: string, memberId: string): Promise<void> {
    await this.run('UPDATE groups SET owner_member_id = ? WHERE id = ?', memberId, groupId);
  }

  async touchGroup(groupId: string, now: number): Promise<void> {
    await this.run('UPDATE groups SET last_active_at = ? WHERE id = ?', now, groupId);
  }

  async deleteGroup(groupId: string): Promise<void> {
    const tables = ['group_members', 'group_bans', 'group_shares'];
    await this.db.batch([
      ...tables.map((t) => this.db.prepare(`DELETE FROM ${t} WHERE group_id = ?`).bind(groupId)),
      this.db.prepare('DELETE FROM groups WHERE id = ?').bind(groupId),
    ]);
  }

  async listMembers(groupId: string): Promise<MemberRow[]> {
    const rows = await this.all<MemberDbRow>(
      'SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at ASC, member_id ASC',
      groupId,
    );
    return rows.map(toMember);
  }

  async findMemberByDevice(groupId: string, deviceHash: string): Promise<MemberRow | null> {
    const row = await this.first<MemberDbRow>(
      'SELECT * FROM group_members WHERE group_id = ? AND device_hash = ?',
      groupId,
      deviceHash,
    );
    return row ? toMember(row) : null;
  }

  async groupsOfDevice(
    deviceHash: string,
  ): Promise<Array<{ group: GroupRow; memberId: string; members: number }>> {
    const rows = await this.all<GroupDbRow & { my_member_id: string; members: number }>(
      `SELECT g.*, m.member_id AS my_member_id,
         (SELECT COUNT(*) FROM group_members c WHERE c.group_id = g.id) AS members
       FROM group_members m JOIN groups g ON g.id = m.group_id
       WHERE m.device_hash = ? ORDER BY g.created_at ASC, g.id ASC`,
      deviceHash,
    );
    return rows.map((r) => ({ group: toGroup(r), memberId: r.my_member_id, members: r.members }));
  }

  private insertMember(m: MemberRow): D1PreparedStatement {
    return this.db
      .prepare(
        'INSERT INTO group_members (group_id, member_id, device_hash, alias, joined_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(m.groupId, m.memberId, m.deviceHash, m.alias, m.joinedAt);
  }

  async addMember(member: MemberRow): Promise<void> {
    await this.insertMember(member).run();
  }

  async updateAlias(groupId: string, memberId: string, alias: string): Promise<void> {
    await this.run(
      'UPDATE group_members SET alias = ? WHERE group_id = ? AND member_id = ?',
      alias,
      groupId,
      memberId,
    );
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    await this.db.batch([
      this.db
        .prepare('DELETE FROM group_shares WHERE group_id = ? AND member_id = ?')
        .bind(groupId, memberId),
      this.db
        .prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?')
        .bind(groupId, memberId),
    ]);
  }

  async isBanned(groupId: string, deviceHash: string): Promise<boolean> {
    const row = await this.first<{ one: number }>(
      'SELECT 1 AS one FROM group_bans WHERE group_id = ? AND device_hash = ?',
      groupId,
      deviceHash,
    );
    return row !== null;
  }

  async ban(groupId: string, deviceHash: string): Promise<void> {
    await this.run(
      'INSERT OR IGNORE INTO group_bans (group_id, device_hash) VALUES (?, ?)',
      groupId,
      deviceHash,
    );
  }

  async putStats(deviceHash: string, month: string, statsJson: string, now: number): Promise<void> {
    await this.run(
      `INSERT INTO device_stats (device_hash, month, stats_json, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (device_hash, month) DO UPDATE SET stats_json = excluded.stats_json,
         updated_at = excluded.updated_at`,
      deviceHash,
      month,
      statsJson,
      now,
    );
  }

  async deleteStats(deviceHash: string): Promise<void> {
    await this.run('DELETE FROM device_stats WHERE device_hash = ?', deviceHash);
  }

  async statsForGroup(
    groupId: string,
    month: string,
  ): Promise<Array<{ memberId: string; alias: string; statsJson: string }>> {
    const rows = await this.all<{ member_id: string; alias: string; stats_json: string }>(
      `SELECT m.member_id, m.alias, s.stats_json
       FROM group_members m JOIN device_stats s ON s.device_hash = m.device_hash
       WHERE m.group_id = ? AND s.month = ? ORDER BY m.joined_at ASC, m.member_id ASC`,
      groupId,
      month,
    );
    return rows.map((r) => ({ memberId: r.member_id, alias: r.alias, statsJson: r.stats_json }));
  }

  async listExpiry(listId: string): Promise<number | null> {
    const row = await this.first<{ expires_at: number }>(
      'SELECT expires_at FROM shared_lists WHERE id = ?',
      listId,
    );
    return row ? row.expires_at : null;
  }

  async addShare(s: ShareRow): Promise<void> {
    await this.run(
      `INSERT INTO group_shares (id, group_id, member_id, kind, ref, title, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.groupId,
      s.memberId,
      s.kind,
      s.ref,
      s.title,
      s.createdAt,
      s.expiresAt,
    );
  }

  async listShares(groupId: string, now: number): Promise<ShareRow[]> {
    const rows = await this.all<ShareDbRow>(
      `SELECT * FROM group_shares WHERE group_id = ? AND expires_at > ?
       ORDER BY created_at DESC, id DESC`,
      groupId,
      now,
    );
    return rows.map(toShare);
  }

  async findShare(groupId: string, shareId: string): Promise<ShareRow | null> {
    const row = await this.first<ShareDbRow>(
      'SELECT * FROM group_shares WHERE group_id = ? AND id = ?',
      groupId,
      shareId,
    );
    return row ? toShare(row) : null;
  }

  async deleteShare(shareId: string): Promise<void> {
    await this.run('DELETE FROM group_shares WHERE id = ?', shareId);
  }

  async trimShares(groupId: string, keep: number): Promise<void> {
    await this.run(
      `DELETE FROM group_shares WHERE group_id = ? AND id NOT IN (
         SELECT id FROM group_shares WHERE group_id = ? ORDER BY created_at DESC, id DESC LIMIT ?)`,
      groupId,
      groupId,
      keep,
    );
  }
}
