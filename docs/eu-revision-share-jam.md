# Revisión del euskera: share.ts y jam.ts

## Cambios hechos

Todo validado por Andoni (hablante nativo). Aplicado solo en `eu`:

- `hub.err.rate_limited`: «Eskaera gehiegi egin dituzu. …»
- `jam.replaced.text`: la frase final ahora es «Jam bakarra egon daiteke aktibo.»
- `shared.nothingToDownload`: «Zerrenda batera gehitu dira.»
- `hub.err.expired`: «Esteken iraupena 90 egunekoa da»; `jam.err.expired` y `jam.ended.expired`:
  «Jam-en iraupena 12 ordukoa da».
- Declinaciones de «Jam», `{date}(e)an` y `{name}(e)k`: aprobadas, sin cambios.

## Dudas para Andoni (todas validadas por Andoni)

| Clave                                                     | Texto actual                                | Propuesta                             | Por qué hay duda                                                                         |
| --------------------------------------------------------- | ------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `hub.err.rate_limited`                                    | Maizegi ari zara egiten.                    | Eskaera gehiegi egin dituzu.          | «Maizegi ari zara egiten» suena incompleto (¿qué se hace?).                              |
| `jam.replaced.text`                                       | …Bakar batean bakarrik egon daiteke aktibo. | …Batean bakarrik egon daiteke aktibo. | «Bakar batean bakarrik» es redundante.                                                   |
| `shared.nothingToDownload`                                | …Zerrenda batean gehitu dira.               | …Zerrenda batera gehitu dira.         | Caso gramatical: «gehitu» suele pedir destino (-ra) en lugar de «-n».                    |
| `hub.err.expired`, `jam.err.expired`, `jam.ended.expired` | Estekek/Jam-ek … irauten dute               | Esteken iraupena 90 egunekoa da       | Concordancia de «iraun» con el sujeto; conviene que lo valide un hablante nativo.        |
| `jam.*`                                                   | «Jam-a», «Jam-ak», «Jam-ei»                 | —                                     | Varía el uso del guion y las declinaciones de «Jam»; se mantiene por coherencia interna. |
| `share.expires`, `shared.expires`, `jam.addedBy`          | `{date}(e)an`, `{name}(e)k`                 | —                                     | Patrón «(e)» válido, pero con nombres/fechas concretos puede salir forma incorrecta.     |
