# BRUTAL. — Juego y trailer

Juego web 8-bit y trailer audiovisual para la fiesta electrónica **BRUTAL.**

## Estructura

```
salva-la-navidance/   el juego (HTML + JS sin dependencias, servidor Node con ranking)
arte-fuente/          arte original en alta: personajes, animaciones, enemigos y elementos
  personajes/
  animaciones/        hojas de animación de cada DJ
  enemigos/
  elementos/          logo y B-Coin
```

Cómo levantar el juego, reglas y publicación: ver [`salva-la-navidance/README.md`](salva-la-navidance/README.md).

### Canciones

Las canciones están solo dentro del juego, en `salva-la-navidance/assets/music/`:

| Archivo | Canción | DJ |
|---|---|---|
| `ivan.mp3` | Play Me | Avila Ivan |
| `hades.mp3` | Animal Rights | BB Hades |
| `matias.mp3` | Energy | Matias Torrelles |

## Cómo trabajamos

1. Nadie sube cambios directo a `main`.
2. Cada mejora va en su propia rama (`mejora/...`, `orden/...`, `fix/...`).
3. Se abre un Pull Request en GitHub y el otro lo revisa.
4. Con la aprobación, se hace merge a `main`.

Antes de abrir un PR: probar el juego en local (`npm start` dentro de `salva-la-navidance`) y correr `npm test`.
