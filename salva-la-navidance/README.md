# SALVA LA NAVIDANCE · BRUTAL.

Juego web 8-bit estilo Mega Man para la fiesta. La gente entra, pone **nombre + Instagram**, elige **DJ** (Ivan rojo, Hades azul o Matias verde) y compite por **terminar el nivel en el menor tiempo**. El ranking queda guardado en una base de datos y desde un panel admin ves el Top 3 con su Instagram para contactarlos.

---

## 1. Cómo levantarlo en Visual Studio Code

1. Instalá **Node.js** (versión 18 o más nueva) desde nodejs.org, si no lo tenés.
2. En VS Code: **Archivo → Abrir carpeta** → elegí `salva-la-navidance`.
3. Abrí la terminal de VS Code (**Terminal → Nueva terminal**) y escribí:

```
npm start
```

4. La terminal muestra las direcciones:
   - **En esta PC:** `http://localhost:3000`
   - **En el celular:** `http://192.168.x.x:3000` (con el celular en el mismo Wi-Fi)
   - **Panel admin:** `http://localhost:3000/admin.html`

> También funciona con *Live Server* o con doble click en `index.html`, pero en ese caso el ranking queda guardado **solo en ese dispositivo**. Para el ranking compartido de la fiesta usá `npm start`.

### Clave del panel admin
Si no la definís, el servidor genera una clave al azar cada vez que arranca y la muestra en la terminal. Para la fiesta, fijá una propia:

```
# Windows (PowerShell)
$env:ADMIN_KEY="tu-clave-secreta"; npm start
# Mac / Linux
ADMIN_KEY=tu-clave-secreta npm start
```

Los datos se guardan en `data/scores.json`. Para empezar el ranking de cero, borrá ese archivo con el servidor apagado.

---

## 2. Reglas del juego

- **La historia:** es Nochebuena en **9 de Julio**, nieva sobre la ciudad y **MECHA-NOEL**, un Papá Noel robot gigante, quiere robarse la Navidance. Tu DJ tiene que cruzar la ciudad y vencerlo.
- **Un solo nivel** con 3 zonas: **Ruta 5 nevada** (silos y campo), **Centro navideño** (catedral, palacio municipal, árbol gigante de la plaza, cartel BRUTAL.) y **Autódromo**, con **MECHA-NOEL** como jefe final.
- **Enemigos:** Muñecos Patovica (muñecos de nieve que saltan al beat), Regalos Poseídos (disparan bastones de caramelo), Esferas Malditas (bolas de árbol que vuelan) y Duendes Traviesos que tiran bolas de Navidad.
- **Plataformas:** todas se alcanzan con un salto (verificado con una simulación). Los bafles y las consolas del escenario también se pueden pisar.
- **Combo y FIEBRE:** encadená 5 enemigos sin cortar el combo (2,5 s entre uno y otro) y entrás en **FIEBRE BRUTAL**: corrés más rápido mientras sigas el combo. Si te pegan, se corta.
- El reloj arranca con la cuenta regresiva (3, 2, 1, ¡YA!, al ritmo de la canción) y se frena con el golpe final a Mecha-Noel.
- **Límite: 3 minutos.** Si se termina el tiempo, no entra al ranking.
- Si te matan, volvés al último checkpoint (sin game over), pero el reloj sigue corriendo.
- La pausa **no** frena el reloj (es una carrera: el tiempo es real).
- Si caés a un pozo, volvés al último piso seguro y perdés 1 corazón.
- **Ranking:** mejor tiempo de cada jugador. Desempata el que juntó más B-Coins.
- Los enemigos están **siempre en el mismo lugar**: es una carrera, se puede aprender el recorrido.

### Controles
| Acción | Celular | Teclado | Joystick |
|---|---|---|---|
| Mover | ◀ ▶ | Flechas / A D | Stick / cruceta |
| Saltar (mantener = más alto) | SALTO | Z / Espacio | A |
| Disparar (mantener = ráfaga) | DISP | X / J | X |
| Dash (también en el aire) | DASH | C / Shift | B / RB |
| Pausa | II | Esc / P | Start |
| Reiniciar al instante | (desde la pausa) | R | Select |

### Opciones
Desde el título o la pausa: volumen de música y efectos, vibración (Android) y **destellos y temblor** (apagarlo quita los flashes de pantalla y las sacudidas de cámara, para gente sensible a las luces). Quedan guardadas en cada celular.

### Compartir
- **En resultados**, COMPARTIR arma una placa para historias de Instagram (1080×1920).
- **El link del juego** muestra vista previa con imagen al pegarlo en WhatsApp o Instagram (`assets/img/og.png`), y se puede agregar a la pantalla de inicio del celular con ícono propio.

### Ghost, medallas y rango
- **Ghost:** tu mejor partida corre al lado tuyo como silueta blanca, y en la barra de progreso hay una marca blanca con su posición.
- **Medallas:** al terminar recibís un rango según tu tiempo: **S** < 60 s, **A** < 75 s, **B** < 95 s, **C** el resto. Se ajustan en `js/core.js` (`MEDALS`) cuando haya tiempos reales de la fiesta.

- **Pisotón:** caer encima de un enemigo común lo elimina y te hace rebotar (encadená pisotones para más puntos).
- **Escudo dorado:** 8 segundos inmune. Si tocás enemigos con el escudo, los rompés. Después se rompe solo.
- **B-Coins:** suman puntos (las que sueltan los enemigos vuelan solas hacia vos). Hay 2 **Mega B-Coins** escondidas en el nivel.
- **Corazones:** recuperan 2 de vida.

### Los 3 DJs
Corren, saltan y disparan **exactamente igual** (mismo alcance, mismo daño). Cambia el color del disparo, **su canción** y **su forma de morir**:
- **Ivan (rojo):** estalla en llamas.
- **Hades (azul):** se electrocuta, glitchea y se desintegra en píxeles.
- **Matias (verde):** implota en ondas de sintetizador.

### MECHA-NOEL (jefe final)
Ataca **al ritmo de la canción**, un ataque por compás:
- **Láser de sus lentes:** apunta (línea punteada roja y verde) y en el siguiente beat dispara. Hay que moverse o hacer dash.
- **Lluvia de bolas de Navidad:** una marca roja en el piso avisa dónde va a caer.
- **Pisotón:** manda una onda de nieve y hielo por el piso; hay que saltarla.
- **Descanso:** la hebilla de su cinturón brilla y recibe **doble daño**.
- **SE CORTÓ LA NAVIDAD:** a la mitad de la vida se apagan las luces (solo queda un círculo de luz alrededor tuyo) y ataca más seguido.
- También se le puede saltar en la cabeza (3 de daño).
- A la mitad de la vida entra en **furia** y ataca más seguido.

---

## 3. Música audio-rítmica

Cada DJ tiene su canción (`assets/music/`). Durante la partida suena **solo la canción del personaje elegido, en loop**, y arranca desde el principio en cada intento.
Las canciones fueron analizadas (BPM, beat y energía de graves/medios/agudos en `js/data/music-data.js`). Con eso:
- los cabezales móviles barren el escenario al ritmo y se encienden con los graves,
- las guirnaldas, árboles, carteles de neón y el cartel BRUTAL. titilan en cada beat,
- los bafles laten con el bajo y aparecen láseres en los momentos más fuertes,
- los enemigos saltan, disparan y tiran bolas de Navidad sobre el beat,
- Mecha-Noel elige y lanza sus ataques al compás.

**Para cambiar una canción:** reemplazá el mp3 en `assets/music/` con el mismo nombre (`ivan.mp3`, `hades.mp3`, `matias.mp3`) y pedime que regenere el análisis. Si no, las luces siguen el análisis de la canción anterior.

---

## 4. Publicarlo para la fiesta

**Opción A: servidor propio (recomendada).** Subí la carpeta a cualquier servicio que corra Node (Render, Railway, Fly.io o un VPS) con el comando `npm start` y la variable `ADMIN_KEY`. Después hacés el QR con esa dirección.

**Opción B: hosting estático + Supabase.** Si lo subís a Netlify, Vercel o GitHub Pages (que no corren `server.js`):
1. Creá un proyecto en supabase.com y ejecutá `supabase.sql` en el SQL Editor.
2. En `js/core.js` completá `SUPABASE: { url: '...', anonKey: '...' }`.
3. Los Instagram se ven en Supabase → *Table Editor* → `scores`.

> **Anti-trampa:** con `server.js`, cada partida recibe un token firmado y el servidor anota la largada ("¡YA!") con su propio reloj. Rechaza tiempos que no coinciden con lo que midió él (±3 s de margen por la red), tiempos por debajo de `MIN_SEC` (35 s por defecto: ajustalo al récord real después de probar) y partidas repetidas. Igual, a los ganadores conviene pedirles que repitan una partida en persona antes de dar premios. Con Supabase no hay esa validación, así que antes de entregar premios conviene revisar el Top.

---

## 5. Archivos

```
index.html            juego (registro + canvas)
admin.html            panel con Top 3, Instagram y descarga CSV
server.js             servidor + base de datos (sin dependencias)
supabase.sql          base de datos alternativa en Supabase
css/style.css         estilo 8-bit del registro
js/core.js            ⚙ TODOS los números del juego (vida, velocidad, dash, escudo, 3 minutos…)
js/level.js           el mapa: dónde va cada enemigo, moneda, ítem y checkpoint
js/player.js          movimiento, disparo y las 3 muertes
js/enemies.js         enemigos navideños y Mecha-Noel
js/stage.js           escenario, luces de boliche, láseres, guirnaldas
js/audio.js           canciones, beat y efectos de sonido
js/db.js              conexión con el ranking (servidor / Supabase / local)
js/screens.js         título, elegir DJ, resultados, ranking, pausa
js/hud.js             cronómetro, vidas, monedas, barra del jefe
js/gfx.js             pantalla nítida, fuente pixel, sprites
assets/sprites/       héroes (de tus animaciones) + enemigos, jefe e ítems 8-bit
assets/bg/            escenario 8-bit de 9 de Julio en Navidad (cielo con trineo, campo y silos, centro, primer plano, tiles)
tools/arte.py         genera TODO el arte de fondo, tiles, enemigos y jefe (python tools/arte.py)
assets/fonts/         fuente pixel BRUTAL8 (diseñada para el juego)
assets/music/         una canción por DJ
```

### Atajos para probar
- `?hero=ivan` (o `hades`, `matias`): arranca directo jugando.
- `?hero=ivan&boss=1`: arranca en el jefe final.
- `?debug`: muestra errores en pantalla.


## 6. Arte

El escenario, los tiles, los enemigos y MECHA-NOEL están dibujados píxel por píxel por código en `tools/arte.py` (sin IA, con paleta propia). Para retocar algo:

1. Cambiar la función que lo dibuja en `tools/arte.py` (por ejemplo `catedral()` o `patovica()`).
2. Correr `python tools/arte.py` (necesita Python con Pillow).
3. Subir `NV.VERSION` en `js/core.js` para que los celulares no muestren el arte viejo guardado en caché.
