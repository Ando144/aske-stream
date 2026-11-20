import type { JamRoom } from './jam/room';

export interface HubEnv {
  /** Shared lists and rate-limit counters. */
  DB: D1Database;
  /** One Durable Object per Jam. */
  JAM: DurableObjectNamespace<JamRoom>;
  /** The web app (apps/web/dist). */
  ASSETS: Fetcher;
}

export type HubAppEnv = { Bindings: HubEnv };
