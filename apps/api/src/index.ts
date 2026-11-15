import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';
import { requireAuth } from './lib/auth';
import { HttpError } from './lib/http';
import { authRoutes } from './routes/auth';
import { ingestRoutes } from './routes/ingest';
import { libraryRoutes } from './routes/library';
import { mediaRoutes } from './routes/media';
import { playlistRoutes } from './routes/playlists';
import { radioRoutes } from './routes/radio';
import { stationRoutes } from './routes/stations';
import { trackRoutes } from './routes/tracks';

const app = new Hono<AppEnv>();

app.use('/api/*', secureHeaders());
app.use('/api/*', async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
});

// Public endpoints
app.get('/api/health', (c) => c.json({ ok: true }));
app.route('/api/auth', authRoutes);

// Everything else requires a paired device or the access key
app.use('/api/*', requireAuth);
app.use('/media/*', requireAuth);

app.route('/api/library', libraryRoutes);
app.route('/api/tracks', trackRoutes);
app.route('/api/playlists', playlistRoutes);
app.route('/api/stations', stationRoutes);
app.route('/api/radio', radioRoutes);
app.route('/api/ingest', ingestRoutes);
app.route('/media', mediaRoutes);

app.all('/api/*', (c) => c.json({ error: 'not_found', message: 'Unknown endpoint' }, 404));

// Anything that reaches the Worker outside /api and /media is a static asset.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.code, message: err.message }, err.status);
  }
  console.error('Unhandled error', err);
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500);
});

export default app;
