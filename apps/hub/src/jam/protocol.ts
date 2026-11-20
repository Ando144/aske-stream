import { z } from 'zod';
import { HUB_LIMITS, type JamClientMessage } from '@aske/shared/hub';

const song = z.object({
  videoId: z.string().max(32),
  title: z.string().max(1000),
  artist: z.string().max(1000),
  durationMs: z.number().finite().nonnegative().optional(),
});

const itemId = z.string().min(1).max(64);

const ClientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    memberId: z.string().min(1).max(64),
    nickname: z.string().max(200),
    hostKey: z.string().max(128).optional(),
  }),
  z.object({ type: z.literal('add'), song }),
  z.object({ type: z.literal('vote'), itemId }),
  z.object({ type: z.literal('remove'), itemId }),
  z.object({ type: z.literal('start'), itemId }),
  z.object({ type: z.literal('finish') }),
  z.object({ type: z.literal('end') }),
]);

/** Returns null for anything oversized, not JSON or not a known message. */
export function parseClientMessage(raw: string): JamClientMessage | null {
  if (new TextEncoder().encode(raw).length > HUB_LIMITS.wsMessageMaxBytes) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = ClientMessage.safeParse(json);
  return parsed.success ? (parsed.data as JamClientMessage) : null;
}
