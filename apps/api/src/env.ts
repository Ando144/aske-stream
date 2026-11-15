export interface Env {
  /** Library metadata: tracks, playlists, likes, saved stations. */
  DB: D1Database;
  /** Audio and cover art. Private bucket, only reachable through this Worker. */
  BUCKET: R2Bucket;
  /** Static assets of the PWA (apps/web/dist). */
  ASSETS: Fetcher;
  /**
   * Single-owner access key (Worker secret). The CLI sends it as a Bearer
   * token; a browser exchanges it once for a signed session cookie.
   */
  ACCESS_KEY?: string;
  /** Extra origins allowed to call the API (comma-separated), e.g. a self-hosted web app. */
  CORS_ORIGINS?: string;
}

export interface AppEnv {
  Bindings: Env;
}
