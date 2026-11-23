import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import { GROUP_LIMITS, type GroupShare } from '@aske/shared/groups';
import { HUB_LIMITS, isListId, normalizeJamCode } from '@aske/shared/hub';
import type { HubAppEnv } from '../env';
import { HubHttpError } from '../lib/http';
import { randomCode } from '../lib/ids';
import { enforceRateLimit } from '../lib/rateLimit';
import { deviceHashOf, invalidRequest, readJsonBody, requireMember, type RepoFor } from './auth';
import type { GroupRepo, MemberRow, ShareRow } from './repo';

const HOUR_MS = 3600 * 1000;
const TEN_MIN_MS = 600 * 1000;
const BODY_MAX_BYTES = 2048;

const ShareBody = z.object({
  kind: z.enum(['list', 'jam']),
  ref: z.string(),
  title: z.string().trim().min(1),
});

function toShare(row: ShareRow, aliases: Map<string, string>): GroupShare {
  return {
    id: row.id,
    kind: row.kind,
    ref: row.ref,
    title: row.title,
    memberId: row.memberId,
    alias: aliases.get(row.memberId) ?? '',
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

/** Lists expire with their link; a Jam code lasts as long as the Jam itself. */
async function resolveShare(
  repo: GroupRepo,
  kind: 'list' | 'jam',
  ref: string,
  now: number,
): Promise<{ ref: string; expiresAt: number }> {
  if (kind === 'jam') {
    const code = normalizeJamCode(ref);
    if (!code) throw invalidRequest('That Jam code is not valid');
    return { ref: code, expiresAt: now + HUB_LIMITS.jamTtlMs };
  }
  const expiresAt = isListId(ref) ? await repo.listExpiry(ref) : null;
  if (expiresAt === null || expiresAt <= now) {
    throw new HubHttpError(404, 'not_found', 'That list link does not exist or has expired');
  }
  return { ref, expiresAt };
}

async function addShare(
  repo: GroupRepo,
  groupId: string,
  member: MemberRow,
  raw: unknown,
  now: number,
): Promise<GroupShare> {
  const parsed = ShareBody.safeParse(raw);
  if (!parsed.success) throw invalidRequest('kind, ref and title are required');
  const { kind, title } = parsed.data;
  const target = await resolveShare(repo, kind, parsed.data.ref, now);
  const row: ShareRow = {
    id: randomCode(GROUP_LIMITS.shareIdLength),
    groupId,
    memberId: member.memberId,
    kind,
    ref: target.ref,
    title: Array.from(title).slice(0, LIMITS.nameMax).join(''),
    createdAt: now,
    expiresAt: target.expiresAt,
  };
  await repo.addShare(row);
  await repo.trimShares(groupId, GROUP_LIMITS.maxShares);
  await repo.touchGroup(groupId, now);
  return toShare(row, new Map([[member.memberId, member.alias]]));
}

export function createShareRoutes(repoFor: RepoFor): Hono<HubAppEnv> {
  const app = new Hono<HubAppEnv>();

  app.get('/:id/shares', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const repo = repoFor(c.env);
    const { group } = await requireMember(repo, c.req.param('id'), deviceHash);
    const aliases = new Map((await repo.listMembers(group.id)).map((m) => [m.memberId, m.alias]));
    const rows = await repo.listShares(group.id, Date.now());
    return c.json({ shares: rows.map((row) => toShare(row, aliases)) });
  });

  app.post('/:id/shares', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_share', 30, HOUR_MS);
    const repo = repoFor(c.env);
    const { group, member } = await requireMember(repo, c.req.param('id'), deviceHash);
    const body = await readJsonBody(c.req.raw, BODY_MAX_BYTES);
    return c.json(await addShare(repo, group.id, member, body, Date.now()), 201);
  });

  app.delete('/:id/shares/:shareId', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const repo = repoFor(c.env);
    const { group, member } = await requireMember(repo, c.req.param('id'), deviceHash);
    const share = await repo.findShare(group.id, c.req.param('shareId'));
    if (!share) throw new HubHttpError(404, 'not_found', 'Share not found');
    if (share.memberId !== member.memberId && member.memberId !== group.ownerMemberId) {
      throw new HubHttpError(403, 'not_owner', 'Only the author or the creator can remove it');
    }
    await repo.deleteShare(share.id);
    return c.body(null, 204);
  });

  return app;
}
