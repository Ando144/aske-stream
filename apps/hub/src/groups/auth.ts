import type { Context } from 'hono';
import { GROUP_LIMITS, isGroupId } from '@aske/shared/groups';
import { sha256Hex } from '../lib/crypto';
import { HubHttpError } from '../lib/http';
import type { HubEnv } from '../env';
import type { GroupRepo, GroupRow, MemberRow } from './repo';

export type RepoFor = (env: HubEnv) => GroupRepo;

const DEVICE_KEY = new RegExp(`^[0-9a-f]{${GROUP_LIMITS.deviceKeyHexLength}}$`);

export const invalidRequest = (message: string) =>
  new HubHttpError(400, 'invalid_request', message);

/** Validates `X-Device-Key` and returns its SHA-256: the Hub never stores the key itself. */
export async function deviceHashOf(c: Context): Promise<string> {
  const key = c.req.header('X-Device-Key') ?? '';
  if (!DEVICE_KEY.test(key)) throw invalidRequest('A valid X-Device-Key header is required');
  return sha256Hex(key);
}

/** The group and the caller's membership: 404 if the group is gone, 403 if not a member. */
export async function requireMember(
  repo: GroupRepo,
  groupId: string,
  deviceHash: string,
): Promise<{ group: GroupRow; member: MemberRow }> {
  const group = isGroupId(groupId) ? await repo.findGroup(groupId) : null;
  if (!group) throw new HubHttpError(404, 'group_not_found', 'Group not found');
  const member = await repo.findMemberByDevice(groupId, deviceHash);
  if (!member) throw new HubHttpError(403, 'not_member', 'You are not in this group');
  return { group, member };
}

/** Reads a JSON body, refusing anything bigger than `maxBytes`. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HubHttpError(413, 'invalid_request', 'The request is too big');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw invalidRequest('Body must be valid JSON');
  }
}
