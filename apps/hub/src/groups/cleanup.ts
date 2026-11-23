import { GROUP_LIMITS, oldestKeptMonth } from '@aske/shared/groups';

/** Own file so the older cleanup keeps working with the simple FakeD1 in its tests. */
export async function cleanupGroups(db: D1Database, now: number): Promise<void> {
  const idle = 'SELECT id FROM groups WHERE last_active_at < ?';
  const cutoff = now - GROUP_LIMITS.inactiveTtlMs;
  await db.batch([
    db.prepare(`DELETE FROM group_members WHERE group_id IN (${idle})`).bind(cutoff),
    db.prepare(`DELETE FROM group_bans WHERE group_id IN (${idle})`).bind(cutoff),
    db.prepare(`DELETE FROM group_shares WHERE group_id IN (${idle})`).bind(cutoff),
    db.prepare('DELETE FROM groups WHERE last_active_at < ?').bind(cutoff),
    db.prepare('DELETE FROM group_shares WHERE expires_at < ?').bind(now),
    db.prepare('DELETE FROM device_stats WHERE month < ?').bind(oldestKeptMonth(now)),
    db.prepare(
      'DELETE FROM device_stats WHERE device_hash NOT IN (SELECT device_hash FROM group_members)',
    ),
  ]);
}
