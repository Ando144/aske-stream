# Estado del proyecto

Actualizado: 2026-11-23

## Hecho

- **F1-F7 (hasta v0.7.0):** biblioteca en dispositivo, Cloudflare o Drive; Android; YouTube; ayuda eu/es/en; copia; QR; Hub con playlists compartidas y Jams.
- **v0.8.0-v0.8.6:** estadísticas y Recap locales, Jam fiable, batería, cola de descargas nativa, Enviar al móvil (hasta 1000), notificación con progreso continuo, arranque sin red, aleatorio sin repeticiones, botones Jam y Recibir arreglados.
- **v0.8.7 (publicada: migración 0004, Hub, web, push y tag; el APK lo construye el CI):** F8b grupos de amigos (20 personas, 10 grupos, ranking mensual, playlists y Jams compartidas, interruptor de escuchas aparte, ayuda y privacidad eu/es/en) y animación de arranque con pausa de 0,6 s y salida suave (reduced-motion: solo fundido).

## En curso / siguiente

- Andoni: mirar en GitHub → Actions los APK v0.8.0 a v0.8.7.
- Andoni: probar grupos en dos móviles (crear, unirse, interruptor, estadísticas) y la animación en el APK.
- Arreglar carrera en `setSharing(false)`: una subida en curso (`syncGroupStats`) puede llegar después del `DELETE /stats` y dejar escuchas en el Hub.
- Menor: la primera subida de 12 meses puede rechazarse (400) en UTC−x al cambiar de mes (`isAcceptableMonth` cuenta en UTC); mejor descartar meses viejos en silencio.
- Pendiente de v0.8.3: Jam en dos móviles y `onTimeout` con `adb shell device_config put activity_manager data_sync_fgs_timeout_duration 60000` (restaurar con `delete`).
- F9 modo estudio hecha (fijar pantalla, pantalla de enfoque, campanilla y tarjeta final; sesiones solo con el Recap activado).
- Andoni: conseguir `rain.ogg` y `waves.ogg` CC0 y dejarlos en `apps/web/src/study/sounds/` (hasta entonces solo salen los tres ruidos generados).
- Andoni: probar en el móvil: llamada entrante con la app fijada, campanilla con la pantalla apagada y reinicio de la app a mitad de sesión.

## Decisiones tomadas (y por qué)

- Drive `drive.file`, yt-dlp en el móvil, Opus sin recodificar — gratis y sin perder calidad.
- Cloudflare tope 10 GB, playlists de 1000; la copia nunca borra el origen.
- Publicar: `hub:migrate:remote`, `deploy:hub`, `deploy`, push y tag (7 `package.json` y 8 entradas del lock, con node, no sed).
- Notificación: solo el servicio nativo escribe; progreso con suelo que nunca baja — Android descarta ráfagas.
- `capped` en vez de `exhausted` — exhausted marcaría las canciones 1001+ como no disponibles.
- Sonda de red sin terceros (Cloudflare → su Worker; resto → Hub propio) — privacidad.
- Grupos: el interruptor solo controla las escuchas y enciende el Recap; apagarlo borra tus escuchas del Hub pero no te saca de los grupos; 12 meses por dispositivo; expulsar = veto; identidad = alias + clave aleatoria del dispositivo (el Hub guarda su hash). El permiso siempre pasa por la hoja de consentimiento.
- Estadísticas solo con permiso (RGPD); subdominio workers.dev fijo.

## Problemas conocidos

- `smoke.mjs` da EPERM al limpiar en Windows y deja wrangler/workerd colgados; `gradle.mjs` falla en Windows: usar `.\gradlew.bat assembleRelease`.
- `downloads.ts` (650 líneas) y `player.ts` (745) sin refactorizar, por decisión.
- `D1GroupRepo` sin tests automáticos (no hay D1 en Vitest); `stores/groups.ts` y `groups/sync.ts` se importan en ciclo (funciona).
- La copia no copia orden ni fijado (por decisión); tests de navegador sin ejecutar.
