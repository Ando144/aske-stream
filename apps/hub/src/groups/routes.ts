import { Hono } from 'hono';
import { z } from 'zod';
import {
  isAcceptableMonth,
  normalizeInviteCode,
  sanitizeGroupName,
  utcMonthKey,
  type GroupDetail,
} from '@aske/shared/groups';
import { normalizeNickname } from '@aske/shared/hub';
import type { HubAppEnv } from '../env';
import { HubHttpError } from '../lib/http';
import { enforceRateLimit } from '../lib/rateLimit';
import { deviceHashOf, invalidRequest, readJsonBody, requireMember, type RepoFor } from './auth';
import { createLookRoutes } from './lookRoutes';
import {
  createGroup,
  joinGroup,
  kickMember,
  leaveAll,
  leaveGroup,
  listSummaries,
  renewInvite,
  toDetail,
} from './service';
import { createShareRoutes } from './shareRoutes';
import { createStatsRoutes } from './statsRoutes';

const HOUR_MS = 3600 * 1000;
const TEN_MIN_MS = 600 * 1000;
const BODY_MAX_BYTES = 2048;

const CreateBody = z.object({ name: z.unknown(), alias: z.unknown() });
const JoinBody = z.object({ code: z.string(), alias: z.unknown() });

function aliasOf(raw: unknown): string {
  const alias = typeof raw === 'string' ? normalizeNickname(raw) : null;
  if (!alias) throw invalidRequest('The alias must have 1 to 24 characters');
  return alias;
}

async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await readJsonBody(req, BODY_MAX_BYTES));
  if (!parsed.success) throw invalidRequest('The request body is not valid');
  return parsed.data;
}

/** The phone's local month; an odd value must not break the list, so it falls back to UTC. */
function cardMonthKey(raw: string | undefined, now: number): string {
  return raw && isAcceptableMonth(raw, now) ? raw : utcMonthKey(now);
}

export function createGroupRoutes(repoFor: RepoFor): Hono<HubAppEnv> {
  const app = new Hono<HubAppEnv>();

  app.get('/', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const month = cardMonthKey(c.req.query('month'), Date.now());
    return c.json({ groups: await listSummaries(repoFor(c.env), deviceHash, month) });
  });

  app.post('/', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_create', 10, HOUR_MS);
    const body = await parseBody(c.req.raw, CreateBody);
    const name = sanitizeGroupName(body.name);
    if (!name) throw invalidRequest('The group needs a name');
    const detail = await createGroup(
      repoFor(c.env),
      deviceHash,
      name,
      aliasOf(body.alias),
      Date.now(),
    );
    return c.json(detail, 201);
  });

  app.post('/join', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_join', 20, TEN_MIN_MS);
    const body = await parseBody(c.req.raw, JoinBody);
    const code = normalizeInviteCode(body.code);
    if (!code) throw new HubHttpError(404, 'group_not_found', 'That invitation does not exist');
    const detail = await joinGroup(
      repoFor(c.env),
      deviceHash,
      code,
      aliasOf(body.alias),
      Date.now(),
    );
    return c.json(detail);
  });

  app.delete('/me', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_erase', 20, TEN_MIN_MS);
    await leaveAll(repoFor(c.env), deviceHash, Date.now());
    return c.body(null, 204);
  });

  app.route('/', createStatsRoutes(repoFor));
  app.route('/', createShareRoutes(repoFor));
  app.route('/', createLookRoutes(repoFor));

  app.get('/:id', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const repo = repoFor(c.env);
    const { group, member } = await requireMember(repo, c.req.param('id'), deviceHash);
    const detail: GroupDetail = toDetail(group, await repo.listMembers(group.id), member.memberId);
    return c.json(detail);
  });

  app.post('/:id/invite', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_invite', 10, HOUR_MS);
    const repo = repoFor(c.env);
    const { group, member } = await requireMember(repo, c.req.param('id'), deviceHash);
    if (member.memberId !== group.ownerMemberId) {
      throw new HubHttpError(403, 'not_owner', 'Only the creator can renew the code');
    }
    return c.json({ inviteCode: await renewInvite(repo, group.id, Date.now()) });
  });

  app.delete('/:id/members/:memberId', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const repo = repoFor(c.env);
    const id = c.req.param('id');
    const { group, member } = await requireMember(repo, id, deviceHash);
    const targetId = c.req.param('memberId');
    if (targetId === member.memberId) {
      await leaveGroup(repo, group, member.memberId, Date.now());
      return c.body(null, 204);
    }
    if (member.memberId !== group.ownerMemberId) {
      throw new HubHttpError(403, 'not_owner', 'Only the creator can remove members');
    }
    const target = (await repo.listMembers(id)).find((m) => m.memberId === targetId);
    if (!target) throw new HubHttpError(404, 'not_found', 'Member not found');
    await kickMember(repo, group, target, Date.now());
    return c.body(null, 204);
  });

  return app;
}
