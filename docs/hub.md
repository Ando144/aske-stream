# Aske Hub

El Hub es un pequeño servidor (un Worker de Cloudflare) que es **común para todos los usuarios**.
Sirve para dos cosas y **nunca guarda música**:

- **Playlists compartidas:** un enlace corto con los identificadores de YouTube y los títulos.
  La app de cada amigo descarga las canciones por su cuenta.
- **Jams en persona:** los amigos entran con un QR, añaden canciones y votan. Solo suena el móvil
  del anfitrión.

También sirve la web, así que quien no tiene la app (o tiene iPhone) puede entrar a una Jam desde
el navegador.

## Qué guarda y cuánto tiempo

| Dato                                               | Cuánto tiempo                   |
| -------------------------------------------------- | ------------------------------- |
| Nombre de la playlist y referencias de canciones   | 90 días (después se borra sola) |
| Apodos y cola de una Jam                           | Como mucho 12 horas             |
| IP (solo como hash con sal diaria, para los topes) | Un día                          |

No hay estadísticas de uso. Los detalles están en [PRIVACY.md](PRIVACY.md).

Para no pasarse del plan gratuito se limita por IP: 20 playlists por hora, 10 Jams por hora y 60
búsquedas cada 10 minutos.

## Cómo desplegarlo

Hace falta una cuenta de Cloudflare y haber iniciado sesión con `npx wrangler login`.

1. Crea la base de datos: `npx wrangler d1 create aske-hub`.
2. Copia el `database_id` que te muestra en `apps/hub/wrangler.jsonc` (sustituye
   `REPLACE_WITH_HUB_D1_ID`).
3. Crea las tablas: `npm run hub:migrate:remote`.
4. Publica: `npm run deploy:hub` (construye la web y despliega el Worker).
5. Pon la URL que te da Cloudflare en `HUB_URL` de `apps/web/src/config.ts` (o con la variable
   `VITE_HUB_URL` al construir) y vuelve a construir la app.

## Probarlo en local

1. `npm run hub:migrate:local`
2. `npm run dev:hub` (queda en <http://localhost:8788>).
3. Comprueba que responde: `curl http://localhost:8788/hub/v1/health`.

## Dónde está cada cosa

- `apps/hub/src/routes/lists.ts`: playlists compartidas.
- `apps/hub/src/jam/`: la Jam (un Durable Object por Jam).
- `apps/hub/src/cleanup.ts`: limpieza diaria (cron a las 03:17 UTC).
- `packages/shared/src/hub.ts`: tipos y límites compartidos con la app.
