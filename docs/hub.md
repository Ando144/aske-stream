# Aske Hub

El Hub es un pequeño servidor (un Worker de Cloudflare) que es **común para todos los usuarios**.
Sirve para tres cosas y **nunca guarda música**:

- **Playlists compartidas:** un enlace corto con los identificadores de YouTube y los títulos.
  La app de cada amigo descarga las canciones por su cuenta.
- **Jams en persona:** los amigos entran con un QR, añaden canciones y votan. Solo suena el móvil
  del anfitrión.
- **Enviar al móvil:** una lista de canciones con un código de un solo uso (6 símbolos y QR). Sirve
  para pasar canciones del ordenador a un móvil, o de un móvil a otro. El móvil que recibe las
  descarga por su cuenta.

También sirve la web, así que quien no tiene la app (o tiene iPhone) puede entrar a una Jam desde
el navegador.

## Qué guarda y cuánto tiempo

| Dato                                               | Cuánto tiempo                   |
| -------------------------------------------------- | ------------------------------- |
| Nombre de la playlist y referencias de canciones   | 90 días (después se borra sola) |
| Apodos y cola de una Jam                           | Como mucho 12 horas             |
| Lista de canciones para enviar al móvil            | hasta 24 h o hasta recibirla    |
| IP (solo como hash con sal diaria, para los topes) | Un día                          |

No hay estadísticas de uso. Los detalles están en [PRIVACY.md](PRIVACY.md).

Para no pasarse del plan gratuito se limita por IP: 20 playlists por hora, 10 Jams por hora, 60
búsquedas cada 10 minutos, 30 envíos al móvil por hora y 20 intentos de recibir o cancelar un
código cada 10 minutos (consultar el estado de un envío admite 300 cada 10 minutos). Un envío admite hasta 200 canciones. El que envía recibe una clave secreta (solo se guarda
su hash) para ver si sigue esperando o cancelarlo.

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
- `apps/hub/src/routes/parcels.ts`: envíos al móvil con código.
- `apps/hub/src/routes/search.ts`: búsqueda en YouTube para quien no tiene Cloudflare (ordenador).
- `apps/hub/src/jam/`: la Jam (un Durable Object por Jam).
- `apps/hub/src/cleanup.ts`: limpieza cada hora (cron `17 * * * *`), para que nada viva más de
  unas 25 horas.
- `packages/shared/src/hub.ts`: tipos y límites compartidos con la app.
