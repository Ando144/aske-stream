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

| Dato                                               | Cuánto tiempo                                         |
| -------------------------------------------------- | ----------------------------------------------------- |
| Nombre de la playlist y referencias de canciones   | 90 días (después se borra sola)                       |
| Apodos y cola de una Jam                           | Como mucho 12 horas                                   |
| Lista de canciones para enviar al móvil            | hasta 24 h o hasta recibirla                          |
| Nombre de la playlist enviada al móvil             | hasta 24 h o hasta recibirla                          |
| IP (solo como hash con sal diaria, para los topes) | Un día                                                |
| Grupo: nombre, código de invitación, miembros      | Hasta 180 días sin actividad                          |
| Miembro: apodo y hash de la clave del dispositivo  | Mientras esté en el grupo                             |
| Vetos de personas expulsadas (hash de la clave)    | Mientras exista el grupo                              |
| Escuchas por mes (solo con el interruptor activo)  | Los últimos 12 meses                                  |
| Playlists y Jams compartidas en un grupo           | Hasta que caduque su enlace o Jam (máx. 50 por grupo) |

No se recogen estadísticas de uso de la app. La única excepción son las escuchas que tú decides
compartir con tus grupos (interruptor desactivado por defecto, ver «Grupos»). Los detalles están
en [PRIVACY.md](PRIVACY.md).

Para no pasarse del plan gratuito se limita por IP: 20 playlists por hora, 10 Jams por hora, 60
búsquedas cada 10 minutos, 30 envíos al móvil por hora y 20 intentos de recibir o cancelar un
código cada 10 minutos (consultar el estado de un envío admite 300 cada 10 minutos). Un envío admite hasta 1000 canciones y puede llevar el nombre de una playlist. El que envía recibe una clave secreta (solo se guarda
su hash) para ver si sigue esperando o cancelarlo.

## Leer una playlist de YouTube

`GET /hub/v1/playlists/:id?lang=es|en|eu&continuation=TOKEN` lee una página de una playlist pública
o no listada de YouTube y devuelve sus canciones, el título y cuántas no están disponibles. No guarda
nada. Para leer más páginas se repite la llamada con el `continuation` recibido.

- `:id` debe ser un identificador de playlist válido y `continuation` tiene un tamaño máximo; si no,
  400 `invalid_request`.
- Límite por IP: 120 lecturas cada 10 minutos.
- Si YouTube no responde, 502 `search_unavailable`. Si la primera página no trae canciones ni título
  (playlist privada o borrada), 404 `playlist_unavailable`.

## Envíos con nombre de playlist

`POST /hub/v1/parcels` acepta además `name` (nombre de la playlist, se limpia y se recorta a 120
caracteres) y `unavailable` (cuántas canciones se saltaron por no estar disponibles, 0 por defecto).
`POST /hub/v1/parcels/:code/claim` los devuelve al móvil que recibe. Los envíos antiguos siguen
valiendo: sin nombre se tratan como canciones sueltas.

La migración `apps/hub/migrations/0003_parcel_playlist.sql` añade las columnas `name` y
`unavailable` a `parcels`. Aplícala con `npm run hub:migrate:remote` antes de desplegar.

## Grupos

Un grupo reúne hasta 20 personas (y cada dispositivo puede estar en 10) para ver un ranking de
escuchas y pasarse playlists y Jams. No hay cuentas ni email: cada dispositivo genera una clave
aleatoria de 64 caracteres hex, la envía en la cabecera `X-Device-Key` y el Hub solo guarda su hash.

API en `/hub/v1/groups` (todas exigen `X-Device-Key`; si falta o es inválida, 400 `invalid_request`):

| Método y ruta                                         | Para qué                                               |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `GET /`                                               | Mis grupos                                             |
| `POST /`                                              | Crear grupo (`name`, `alias`)                          |
| `POST /join`                                          | Entrar con código (`code`, `alias`)                    |
| `GET /:id`                                            | Detalle y miembros                                     |
| `POST /:id/invite`                                    | Renovar el código (solo el creador)                    |
| `DELETE /:id/members/:memberId`                       | Salir (uno mismo) o expulsar y vetar (solo el creador) |
| `DELETE /me`                                          | Salir de todos los grupos y borrar mis escuchas        |
| `PUT /stats`                                          | Subir hasta 12 meses de escuchas                       |
| `DELETE /stats`                                       | Borrar mis escuchas del Hub (no saca de los grupos)    |
| `GET /:id/stats?month=YYYY-MM`                        | Ranking del grupo y escuchas de cada persona           |
| `GET/POST /:id/shares`, `DELETE /:id/shares/:shareId` | Playlists y Jams compartidas en el grupo               |

Límites: 20 personas por grupo, 10 grupos por dispositivo, nombre de hasta 40 caracteres, 50
elementos compartidos por grupo y escuchas de los últimos 12 meses (se cuenta el mes UTC actual y
los 11 anteriores). Por IP: 10 grupos creados por hora, 20 intentos de entrar cada 10 minutos, 30
subidas de escuchas por hora y 300 lecturas cada 10 minutos. Errores propios: `group_not_found`,
`group_full`, `not_member`, `not_owner`, `kicked` y `too_many_groups`.

Las escuchas se envían solo si la persona activa «Compartir mis escuchas con mis grupos» (lo que
también enciende el Recap en su móvil). Al apagarlo se borran del Hub, pero la persona sigue en
sus grupos. La limpieza horaria borra los grupos sin actividad en 180 días y los meses de escuchas
más antiguos de 12.

La migración `apps/hub/migrations/0004_groups.sql` crea las tablas `groups`, `group_members`,
`group_bans`, `device_stats` y `group_shares`. Aplícala con `npm run hub:migrate:remote` **antes**
de `npm run deploy:hub`.

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
- `apps/hub/src/routes/playlists.ts`: lectura de playlists de YouTube para elegir canciones.
- `apps/hub/src/routes/search.ts`: búsqueda en YouTube para quien no tiene Cloudflare (ordenador).
- `apps/hub/src/groups/`: grupos de amigos (rutas, acceso a D1, ranking y limpieza).
- `apps/hub/src/jam/`: la Jam (un Durable Object por Jam).
- `apps/hub/src/cleanup.ts`: limpieza cada hora (cron `17 * * * *`), para que nada viva más de
  unas 25 horas.
- `packages/shared/src/hub.ts`: tipos y límites compartidos con la app.
