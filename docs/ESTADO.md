# Estado del proyecto

Actualizado: 2026-11-20

## Hecho

- **F1-F6 (hasta v0.6.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia entre almacenamientos; carpetas y playlists; vinculación por QR; asistente de Cloudflare. App publicada en Google Cloud.
- **F7 (v0.7.0, publicada; el CI de GitHub ya creó el APK):** `apps/hub` (Worker aparte en `https://aske-hub.andoni-otzdezarate.workers.dev`, D1 `aske-hub`, API `/hub/v1/*`). Playlists compartidas con enlace `#list=` (90 días). Jams con Durable Object, WebSocket y QR `#jam=` (12 h, apodo sin cuentas, solo suena el móvil anfitrión, solo Android).
- **Arreglos de F6/F7 (sin commitear):** Jam: el cierre 4001 es final y muestra aviso con «Usar aquí»; `room.ts` con `safeSend`/`safeClose`. Cloudflare: tras `subdomain_taken` se conserva el token, pasos de `RunningStep` corregidos, `CloudflareSetupView` bajo 50 líneas, `useHashCredentials` comentado. Test de `hubClient` arreglado.
- **F8a (sin commitear):** estadísticas y Recap personales, solo en el dispositivo. Módulo `src/stats/`, IndexedDB v4 (almacén `plays`), diálogo de permiso la primera vez (nada se guarda hasta aceptar), desactivar borra todo, solo música (no podcasts ni radio), cuenta al pasar el menor entre 30 s y la mitad, las saltadas se guardan marcadas y no suman. Pantalla `/recap` con mes y año, ajustes, ayuda y párrafo en `PRIVACY.md`. Revisor APROBADO, `npm run check` verde.

## En curso / siguiente

- **Andoni:** validar las 6 dudas de euskera de `docs/eu-revision-share-jam.md` (nadie cambió `share.ts` ni `jam.ts`); probar a mano el Recap (`npm run dev`) y `npm run test:e2e`; probar la Jam en dos móviles reales.
- **MEDIO F8a:** `openDB` sin `blocking`/`blocked` (una pestaña con la v3 bloquea la subida a v4); quitar «private yearly Recap» de la fila 8 de `docs/v2/architecture.md`; reformular la frase de «Estadísticas» en `PRIVACY.md` (ES). `SettingsView` ronda 240 líneas (deuda antigua).
- **Batería (Pixel, versión sin confirmar, 6:20 100 % → 9:18 63 %):** 6:20-8:00 gastó 35 % con 3 min de pantalla y 8 min en segundo plano; 8:00-9:18 gastó 12 % con menos de 1 min de pantalla y 1 h 17 min en segundo plano (~9 %/h). Investigado (solo código): nada despierta el móvil con la app parada; lo caro es música sonando (wake lock y Wi-Fi lock), la rotación offline en segundo plano, una Jam olvidada o una descarga atascada. Ya aplicado: renovación del wake lock cada 10 min solo si suena, rotación offline en segundo plano solo cargando o con Wi-Fi sin ahorro, y la Jam deja de reintentar a los 5 min. Falta medir en el Pixel (`adb shell dumpsys batterystats --reset`, 1 h con música en pausa, luego `dumpsys batterystats` y `dumpsys power`, saliendo antes de cualquier Jam) y compilar el APK (Java nuevo `powerSave`/`charging` sin compilar).
- **MEDIO batería:** `lastScheduledRun` en `player.ts` se actualiza antes de saber si se permite rotar; la PWA ya no rota con la pestaña oculta; `LostNotice` de la Jam no deja salir al invitado sin red.
- **Siguientes fases:** F8b grupos (Recap compartido); F9 modo estudio; «Enviar al móvil» vía Hub.

## Decisiones tomadas (y por qué)

- Drive con `drive.file`, yt-dlp en el móvil, APK por GitHub Releases, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare solo Opus, tope 10 GB, playlists de hasta 1000. Copia: nunca borra el origen.
- Publicar: `db:migrate:remote`, luego `deploy` (al revés da 500), `deploy:hub`, push y tag. La versión sale de `package.json`: subirla antes. Hay 7 `package.json`.
- Hub único de Andoni, nunca guarda música; 30 personas y 200 canciones por Jam.
- Estadísticas: solo en el dispositivo, con permiso explícito (RGPD) y sin enviar nada; por eso la F8b necesitará consentimiento aparte.
- Se deja el subdominio `andoni-otzdezarate.workers.dev`: cambiarlo rompería los móviles vinculados.

## Problemas conocidos

- Los tests de F6 y del Hub usan una API de Cloudflare, un D1 y una sala simulados.
- `scripts/smoke.mjs` sale con EPERM en Windows y puede dejar wrangler/workerd colgados.
- La copia entre almacenamientos no copia el orden ni lo fijado.
- `DownloadView.tsx` 876 líneas. Tests de navegador sin ejecutar; APK local sin generar.
