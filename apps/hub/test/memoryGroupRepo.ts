import type { GroupRepo, GroupRow, MemberRow, ShareRow } from '../src/groups/repo';

interface StatsRow {
  statsJson: string;
  updatedAt: number;
}

/** In-memory GroupRepo with the same ordering, collisions and cascades as the D1 one. */
export class MemoryGroupRepo implements GroupRepo {
  groups = new Map<string, GroupRow>();
  members: MemberRow[] = [];
  bans = new Set<string>();
  stats = new Map<string, StatsRow>(); // `${deviceHash}|${month}`
  shares: ShareRow[] = [];
  /** shared_lists stand-in: list id -> expires_at. */
  lists = new Map<string, number>();

  async createGroup(group: GroupRow, owner: MemberRow): Promise<boolean> {
    const clash = this.groups.has(group.id) || this.inviteTaken(group.inviteCode);
    if (clash) return false;
    this.groups.set(group.id, { ...group });
    this.members.push({ ...owner });
    return true;
  }

  private inviteTaken(code: string, exceptGroup?: string): boolean {
    return [...this.groups.values()].some((g) => g.inviteCode === code && g.id !== exceptGroup);
  }

  async findGroup(id: string): Promise<GroupRow | null> {
    const g = this.groups.get(id);
    return g ? { ...g } : null;
  }

  async findGroupByInvite(code: string): Promise<GroupRow | null> {
    const g = [...this.groups.values()].find((x) => x.inviteCode === code);
    return g ? { ...g } : null;
  }

  async setInviteCode(groupId: string, code: string): Promise<boolean> {
    if (this.inviteTaken(code, groupId)) return false;
    const g = this.groups.get(groupId);
    if (g) g.inviteCode = code;
    return true;
  }

  async setOwner(groupId: string, memberId: string): Promise<void> {
    const g = this.groups.get(groupId);
    if (g) g.ownerMemberId = memberId;
  }

  async touchGroup(groupId: string, now: number): Promise<void> {
    const g = this.groups.get(groupId);
    if (g) g.lastActiveAt = now;
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.groups.delete(groupId);
    this.members = this.members.filter((m) => m.groupId !== groupId);
    this.shares = this.shares.filter((s) => s.groupId !== groupId);
    for (const ban of [...this.bans]) if (ban.startsWith(`${groupId}|`)) this.bans.delete(ban);
  }

  async listMembers(groupId: string): Promise<MemberRow[]> {
    return this.members
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.memberId.localeCompare(b.memberId))
      .map((m) => ({ ...m }));
  }

  async findMemberByDevice(groupId: string, deviceHash: string): Promise<MemberRow | null> {
    const m = this.members.find((x) => x.groupId === groupId && x.deviceHash === deviceHash);
    return m ? { ...m } : null;
  }

  async groupsOfDevice(deviceHash: string) {
    const mine = this.members.filter((m) => m.deviceHash === deviceHash);
    const out = mine.flatMap((m) => {
      const group = this.groups.get(m.groupId);
      if (!group) return [];
      const members = this.members.filter((x) => x.groupId === group.id).length;
      return [{ group: { ...group }, memberId: m.memberId, members }];
    });
    return out.sort(
      (a, b) => a.group.createdAt - b.group.createdAt || a.group.id.localeCompare(b.group.id),
    );
  }

  async addMember(member: MemberRow): Promise<void> {
    const dup = this.members.some(
      (m) =>
        m.groupId === member.groupId &&
        (m.memberId === member.memberId || m.deviceHash === member.deviceHash),
    );
    if (dup) throw new Error('UNIQUE constraint failed: group_members');
    this.members.push({ ...member });
  }

  async updateAlias(groupId: string, memberId: string, alias: string): Promise<void> {
    const m = this.members.find((x) => x.groupId === groupId && x.memberId === memberId);
    if (m) m.alias = alias;
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    this.members = this.members.filter((m) => !(m.groupId === groupId && m.memberId === memberId));
    this.shares = this.shares.filter((s) => !(s.groupId === groupId && s.memberId === memberId));
  }

  async isBanned(groupId: string, deviceHash: string): Promise<boolean> {
    return this.bans.has(`${groupId}|${deviceHash}`);
  }

  async ban(groupId: string, deviceHash: string): Promise<void> {
    this.bans.add(`${groupId}|${deviceHash}`);
  }

  async putStats(deviceHash: string, month: string, statsJson: string, now: number) {
    this.stats.set(`${deviceHash}|${month}`, { statsJson, updatedAt: now });
  }

  async deleteStats(deviceHash: string): Promise<void> {
    for (const key of [...this.stats.keys()]) {
      if (key.startsWith(`${deviceHash}|`)) this.stats.delete(key);
    }
  }

  async statsForGroup(groupId: string, month: string) {
    const members = await this.listMembers(groupId);
    return members.flatMap((m) => {
      const row = this.stats.get(`${m.deviceHash}|${month}`);
      return row ? [{ memberId: m.memberId, alias: m.alias, statsJson: row.statsJson }] : [];
    });
  }

  async listExpiry(listId: string): Promise<number | null> {
    return this.lists.get(listId) ?? null;
  }

  async addShare(share: ShareRow): Promise<void> {
    this.shares.push({ ...share });
  }

  async listShares(groupId: string, now: number): Promise<ShareRow[]> {
    return this.shares
      .filter((s) => s.groupId === groupId && s.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
      .map((s) => ({ ...s }));
  }

  async findShare(groupId: string, shareId: string): Promise<ShareRow | null> {
    const s = this.shares.find((x) => x.groupId === groupId && x.id === shareId);
    return s ? { ...s } : null;
  }

  async deleteShare(shareId: string): Promise<void> {
    this.shares = this.shares.filter((s) => s.id !== shareId);
  }

  async trimShares(groupId: string, keep: number): Promise<void> {
    const newest = this.shares
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
      .slice(0, keep)
      .map((s) => s.id);
    this.shares = this.shares.filter((s) => s.groupId !== groupId || newest.includes(s.id));
  }
}
