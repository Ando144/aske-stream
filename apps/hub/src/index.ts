import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { HubAppEnv, HubEnv } from './env';
import { cleanup } from './cleanup';
import { cleanupGroups } from './groups/cleanup';
import { D1GroupRepo } from './groups/repo';
import { createGroupRoutes } from './groups/routes';
import { HubHttpError } from './lib/http';
import { jamRoutes } from './jam/routes';
import { listRoutes } from './routes/lists';
import { parcelRoutes } from './routes/parcels';
import { playlistRoutes } from './routes/playlists';
import { searchRoutes } from './routes/search';
import { HUB_VERSION } from './version';

const app = new Hono<HubAppEnv>();

app.use(
  '/hub/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'X-Delete-Key', 'X-Device-Key'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
);
app.use('/hub/*', secureHeaders());
app.use('/hub/*', async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
});

app.get('/hub/v1/health', (c) => c.json({ ok: true, hub: true, version: HUB_VERSION }));
app.route('/hub/v1/lists', listRoutes);
app.route(
  '/hub/v1/groups',
  createGroupRoutes((env) => new D1GroupRepo(env.DB)),
);
app.route('/hub/v1/jams', jamRoutes);
app.route('/hub/v1/parcels', parcelRoutes);
app.route('/hub/v1/playlists', playlistRoutes);
app.route('/hub/v1/search', searchRoutes);
app.all('/hub/*', (c) => c.json({ error: 'not_found', message: 'Unknown endpoint' }, 404));

// Anything outside /hub is the web app (so a Jam QR also opens in a browser).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HubHttpError) {
    return c.json({ error: err.code, message: err.message }, err.status);
  }
  console.error('Unhandled error', err);
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500);
});

export { JamRoom } from './jam/room';

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledController, env: HubEnv, ctx: ExecutionContext) {
    const now = Date.now();
    ctx.waitUntil(Promise.all([cleanup(env, now), cleanupGroups(env.DB, now)]));
  },
};
