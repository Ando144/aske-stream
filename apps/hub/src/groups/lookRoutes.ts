import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  GROUP_LIMITS,
  normalizeInviteCode,
  sanitizeGroupName,
  type GroupPreview,
} from '@aske/shared/groups';
import type { HubAppEnv } from '../env';
import { HubHttpError } from '../lib/http';
import { checkRateLimit, enforceRateLimit } from '../lib/rateLimit';
import { deviceHashOf, invalidRequest, readJsonBody, requireMember, type RepoFor } from './auth';
import type { GroupRow } from './repo';
import { isJpeg, toDetail } from './service';

const HOUR_MS = 3600 * 1000;
const TEN_MIN_MS = 600 * 1000;
const BODY_MAX_BYTES = 2048;

const NameBody = z.object({ name: z.unknown() });
const PeekBody = z.object({ code: z.string() });

const photoTooBig = () => new HubHttpError(413, 'invalid_request', 'The photo is too big');
const notJpeg = () => invalidRequest('The photo must be a JPEG image');

/** Any member may edit; the limit is per group so that changing networks does not reset it. */
async function requireEditor(c: Context<HubAppEnv>, repoFor: RepoFor, groupId: string) {
  const deviceHash = await deviceHashOf(c);
  const repo = repoFor(c.env);
  const { group, member } = await requireMember(repo, groupId, deviceHash);
  const key = `group_edit:${group.id}`;
  if (!(await checkRateLimit(c.env.DB, key, GROUP_LIMITS.editsPerHour, HOUR_MS))) {
    throw new HubHttpError(429, 'rate_limited', 'Too many changes, try again later');
  }
  return { repo, group, member };
}

/** Checks the declared size first, so an oversized upload is never read into memory. */
async function readPhoto(req: Request): Promise<Uint8Array> {
  if (req.headers.get('Content-Type') !== 'image/jpeg') throw notJpeg();
  if (Number(req.headers.get('Content-Length') ?? 0) > GROUP_LIMITS.photoMaxBytes) {
    throw photoTooBig();
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > GROUP_LIMITS.photoMaxBytes) throw photoTooBig();
  if (!isJpeg(bytes)) throw notJpeg();
  return bytes;
}

function photoResponse(c: Context<HubAppEnv>, photo: Uint8Array | null): Response {
  if (!photo) throw new HubHttpError(404, 'not_found', 'This group has no photo');
  return c.body(new Uint8Array(photo), 200, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=86400',
  });
}

/** The group behind an invite code, for someone who may not be a member yet. */
async function invitedGroup(c: Context<HubAppEnv>, repoFor: RepoFor): Promise<GroupRow> {
  const deviceHash = await deviceHashOf(c);
  await enforceRateLimit(c, c.env.DB, 'group_peek', GROUP_LIMITS.peekPer10Min, TEN_MIN_MS);
  const body = PeekBody.safeParse(await readJsonBody(c.req.raw, BODY_MAX_BYTES));
  if (!body.success) throw invalidRequest('The request body is not valid');
  const code = normalizeInviteCode(body.data.code);
  const repo = repoFor(c.env);
  const group = code ? await repo.findGroupByInvite(code) : null;
  if (!group) throw new HubHttpError(404, 'group_not_found', 'That invitation does not exist');
  if (await repo.isBanned(group.id, deviceHash)) {
    throw new HubHttpError(403, 'kicked', 'You were removed from this group');
  }
  return group;
}

function addEditRoutes(app: Hono<HubAppEnv>, repoFor: RepoFor): void {
  app.put('/:id/name', async (c) => {
    const { repo, group, member } = await requireEditor(c, repoFor, c.req.param('id'));
    const body = NameBody.safeParse(await readJsonBody(c.req.raw, BODY_MAX_BYTES));
    const name = body.success ? sanitizeGroupName(body.data.name) : null;
    if (!name) throw invalidRequest('The group needs a name');
    await repo.renameGroup(group.id, name, Date.now());
    const members = await repo.listMembers(group.id);
    return c.json(toDetail({ ...group, name }, members, member.memberId));
  });

  app.put('/:id/photo', async (c) => {
    const { repo, group } = await requireEditor(c, repoFor, c.req.param('id'));
    const photo = await readPhoto(c.req.raw);
    const photoAt = Date.now();
    await repo.putPhoto(group.id, photo, photoAt);
    return c.json({ photoAt });
  });

  app.delete('/:id/photo', async (c) => {
    const { repo, group } = await requireEditor(c, repoFor, c.req.param('id'));
    await repo.deletePhoto(group.id, Date.now());
    return c.body(null, 204);
  });
}

function addPeekRoutes(app: Hono<HubAppEnv>, repoFor: RepoFor): void {
  // POST so that the invite code never ends up in a URL or in request logs.
  app.post('/peek', async (c) => {
    const group = await invitedGroup(c, repoFor);
    const members = await repoFor(c.env).listMembers(group.id);
    const preview: GroupPreview = {
      name: group.name,
      members: members.length,
      photoAt: group.photoAt,
    };
    return c.json(preview);
  });

  app.post('/peek/photo', async (c) => {
    const group = await invitedGroup(c, repoFor);
    return photoResponse(c, await repoFor(c.env).getPhoto(group.id));
  });
}

export function createLookRoutes(repoFor: RepoFor): Hono<HubAppEnv> {
  const app = new Hono<HubAppEnv>();
  addEditRoutes(app, repoFor);
  addPeekRoutes(app, repoFor);

  app.get('/:id/photo', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const repo = repoFor(c.env);
    const { group } = await requireMember(repo, c.req.param('id'), deviceHash);
    return photoResponse(c, await repo.getPhoto(group.id));
  });

  return app;
}
