# Estado del proyecto (v0.5.0, noviembre 2026)

## Hecho

- **F1:** biblioteca en dispositivo, Cloudflare o Drive; se cambia en Ajustes sin borrar nada.
- **F2:** app Android con audio en segundo plano y actualizador interno (APK según arm64/armv7).
- **F3:** búsqueda y descarga de YouTube en el móvil (canciones, playlists, cola persistente,
  pantalla apagada) y «Enviar al móvil» desde el ordenador (cola en D1).
- **F4:** introducción, primeros pasos, consejos por pantalla y ayuda (33 artículos eu/es/en).
- **F5:** Google Drive (Android y web), «Volver a conectar» en web, copia dispositivo → Drive,
  cuota en Ajustes. OAuth hecho: cliente web en `config.ts`, Android con el SHA-1 de release.

## Siguientes pasos

1. Copiar música en cualquier dirección (hoy solo dispositivo → Drive, `stores/copyToDrive.ts`).
2. Meter en CI los tests de navegador de `apps/web/test/browser/` (Playwright en Python, falso Drive).
3. **Fase 6:** asistente en la app para montar Cloudflare y emparejar con QR desde un dispositivo ya conectado.
4. **Fase 7:** playlists compartidas (enlace o QR, de solo lectura o colaborativas) y Jams en persona.
5. **Fase 8:** estadísticas anónimas con consentimiento (desactivadas por defecto) y panel de administración.

## Decisiones (y por qué)

- **Permiso `drive.file`:** no es sensible, así que Google no exige revisión, y la app solo ve su carpeta «Aske Stream».
- **Un `library.json` en Drive** con copia local en IndexedDB (envío 3 s después): gana el
  `updatedAt` más reciente de cada elemento; los borrados son definitivos (ids aleatorios).
- **Audio de Drive en `blob:`:** Drive solo acepta el token en una cabecera y `<audio>` no puede enviarla.
- **Reproductor en el `<audio>` del WebView** también en Android: un solo código web/app.
- **yt-dlp en el móvil, no en el servidor:** evita bloqueos de IP y servidores de pago.
- **APK por GitHub Releases, sin Play Store:** gratis y sin revisiones. Un APK por arquitectura.
- **Opus sin recodificar:** calidad original y menos batería.

## Bugs y límites conocidos

- La rotación sin conexión solo corre con la app abierta o sonando.
- Las canciones de Drive se descargan enteras antes de sonar: tardan un poco más en empezar.
- En la web, el token de Google dura 1 h y renovarlo necesita un toque.
- La copia a Drive necesita la app abierta; luego el dispositivo no libera el espacio.
- Las marcas de borrado de `library.json` crecen sin límite (podar las antiguas).
- En iPhone el audio en segundo plano no es fiable (fallos de WebKit) y no hay descargas.
- yt-dlp se rompe a veces cuando YouTube cambia. Se actualiza desde la app (Descargar → motor).
