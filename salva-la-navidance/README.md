# SALVA LA NAVIDANCE · BRUTAL.

Juego web 8-bit estilo Mega Man para la fiesta. La gente entra, pone **nombre + Instagram**, elige **DJ** (IVAN rojo, BB HADES azul o MATIAS verde) y compite por **terminar el nivel en el menor tiempo** venciendo a **ROBO-GRINCH**. El ranking queda guardado en una base de datos y desde un panel admin ves el Top 3 con su Instagram para contactarlos.

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

Los datos se guardan en `data/players.json` (un jugador por Instagram) y `data/scores.json` (historial de partidas). Para empezar el ranking de cero, borrá esos dos archivos con el servidor apagado.

---

## 2. Reglas del juego

- **Al abrir el juego:** logo de BRUTAL. en 8-bit → créditos en pantalla negra ("DESIGNED & PRODUCED BY" / **DKZ & AM**) → historia → menú. Cada pantalla de presentación dura 10 s (entrada, pantalla completa y fundido a negro); con los créditos ya empieza la canción del menú. Tocar o apretar una tecla adelanta.
- **La historia:** es Nochebuena en **9 de Julio**, nieva sobre la ciudad y **ROBO-GRINCH** (mitad Grinch, mitad robot, con saco de Papá Noel) cortó la luz y se robó los parlantes de la Navidance. Tu DJ tiene que cruzar la ciudad y vencerlo. La intro son 4 escenas con cuadro de diálogo: tocar/tecla completa el texto, otra vez pasa a la siguiente; **SALTEAR** (o Esc) va directo al menú.
- **Un solo nivel** con 3 zonas: **Ruta 5 nevada**, **Centro navideño** y **Autódromo**, con **ROBO-GRINCH** como jefe final.
- **Enemigos:** Muñecos Patovica, Regalos Poseídos, Esferas Malditas y Duendes Traviesos (38 en todo el nivel). Están **siempre en el mismo lugar**: es una carrera, se puede aprender el recorrido.
- **Combo y FIEBRE:** encadená 5 enemigos sin cortar el combo (2,5 s entre uno y otro) y entrás en **FIEBRE BRUTAL**: corrés más rápido mientras sigas el combo.
- **Menú principal:** arranca a oscuras, se enciende el video del logo, se arma la ciudad, se prenden las luces y entran los botones (tocar adelanta la entrada).
- Al terminar la partida: **OTRA VEZ**, **MENÚ PRINCIPAL**, compartir, ranking o cambiar DJ (Esc también vuelve al menú).
- El reloj arranca con la cuenta regresiva (3, 2, 1, ¡YA!, al ritmo de la canción) y se frena con el golpe final al jefe.
- **Límite: 3 minutos.** Si te matan volvés al último checkpoint (sin game over) pero el reloj sigue. La pausa **no** frena el reloj.

### Ranking (nombre + Instagram)
- El **nombre** puede ser cualquiera. El **usuario de Instagram es único**: se registra una sola vez.
- Si alguien pone un Instagram que ya está registrado (por ejemplo, la misma persona desde otro celular), el juego avisa y pide confirmar **"SOY YO, SEGUIR"**: sigue con ese mismo usuario y su mejor tiempo.
- Cada Instagram puede jugar las veces que quiera. En el ranking figura **una sola vez**, con su **mejor tiempo** (un tiempo mejor **reemplaza** al anterior; no se acumulan). Desempata el que juntó más B-Coins.
- El ranking muestra: **NOMBRE · PERSONAJE elegido · TIEMPO**. El Instagram no se muestra en público (solo en el panel admin).
- **Sombra (ghost):** tu mejor partida corre al lado tuyo como silueta blanca. Es siempre la del mismo jugador (se guarda por Instagram en cada dispositivo).
- **Medallas:** **S** < 62 s, **A** < 75 s, **B** < 95 s, **C** el resto. Se ajustan en `js/core.js` (`MEDALS`).

### Controles
| Acción | Celular | Teclado | Joystick |
|---|---|---|---|
| Mover | ◀ ▶ | Flechas / A D | Stick / cruceta |
| Saltar (mantener = más alto) | SALTO | Z / Espacio | A |
| Disparar (mantener = ráfaga) | DISP | X / J | X |
| Dash (también en el aire) | DASH | C / Shift | B / RB |
| Pausa | II | Esc / P | Start |
| Reiniciar al instante | (desde la pausa) | R | Select |

### Arma, dash y fiesta
- **El arma se recalienta:** cada disparo suma calor (barra ARMA). Aguanta unos **11 tiros seguidos**; si llega al máximo se traba hasta enfriarse. El disparo llega a unos **400 px**.
- **El dash gasta energía** (barra DASH): alcanza para 2 seguidos y se recarga en ~1,3 s por dash.
- En **FIEBRE** el arma se enfría y el dash se recarga más rápido.
- **La fiesta sube a medida que avanzás:** láseres de escenario, luces más intensas, estroboscópico y público eufórico.
- **Plataformas con tu color:** la base de las plataformas (no la nieve de arriba) toma el neón del DJ elegido: rojo, azul o verde.
- **La ciudad del fondo va más oscura** durante la partida para que el piso, las plataformas y los personajes resalten (`BG_DIM` en `js/core.js`; 0 = como antes). Las luces audio-rítmicas no se tocan.

### Los 3 DJs
Corren, saltan y disparan **exactamente igual**. Cambia el color, **su canción** y **su forma de morir** (después de la caída animada): **IVAN** estalla en llamas, **BB HADES** se electrocuta y se desintegra, **MATIAS** implota en ondas de sintetizador.

### ROBO-GRINCH (jefe final)
Entrada: alarma, presentación **VS** y cae del cielo sobre su tarima. Ataca al ritmo de la canción, **un ataque cada 2 compases** (más seguido en la fase 2), y **siempre avisa antes**. Ningún ataque persigue al jugador una vez fijado:
- **Láser de las gafas:** la mira punteada sigue al DJ un momento, se **fija** (queda quieta ~1 s; ~0,8 s en fase 2) y recién ahí dispara. Sale siempre del mismo punto de las gafas; solo cambia la dirección.
- **Cohetes:** señala el cielo; cada cohete marca en el piso dónde va a caer (zona, anillo que se cierra y línea punteada) ~1,25 s antes de caer (4 cohetes; 5 en la fase 2). Caen donde se marcaron, no te siguen.
- **Cañón:** el brazo se transforma en cañón, fija una **línea de tiro punteada** y dispara por esa línea.
- **Pisotón:** levanta la pierna y pisa; manda una **onda de sonido** por el piso que hay que saltar.
- **Manotazo:** si te quedás pegado a él, levanta el puño (aviso) y golpea a su lado.
- **Muerte:** chispazos, se arrodilla, explota y **estalla en pedazos** que salen volando y rebotan en el piso.
- Saltarle en la cabeza le hace 2 de daño. **Descanso:** el pecho le brilla y recibe **doble daño**.
- **Cada vez más rápido:** cuanto menos vida tiene, menos espera entre un ataque y otro (4 beats con la vida llena, 1 casi muerto).
- **Cortes de luz:** cada tanto corta la luz unos segundos (queda un círculo de luz alrededor del DJ); en la fase 2 lo hace más seguido. En toda la pelea habla solo 2 veces con su cartel tipo chat ("¡APAGUEN TODO!" y, a la mitad de la vida, "¡SE ACABÓ LA FIESTA!"). **SE CORTÓ LA NAVIDAD:** a la mitad de la vida.
- **Antes de llegar:** casi en el portón del jefe, el Robo-Grinch aparece en el chat ("¡NO DEJEN QUE LLEGUE!") y corta la luz mientras peleás contra los últimos enemigos (una vez por partida).
- Todos los tiempos de aviso están en `js/core.js` → `BOSS` (subilos para hacerlo más fácil, bajalos para más difícil).

---

## 3. Música

- **Menú principal:** *Flower In A Hurricane [GTAVI] – 80s REMIX* (`assets/music/menu.mp3`).
- Al tocar **JUGAR** la canción del menú se pausa; al volver al **MENÚ PRINCIPAL** retoma desde donde había quedado.
- **Al elegir DJ** suena la canción de ese personaje (`ivan.mp3`, `hades.mp3`, `matias.mp3`) y sigue sonando en la partida, la pausa, los resultados y el ranking. **Recién al volver al MENÚ PRINCIPAL** vuelve la canción del menú.
- Todas las canciones están analizadas (BPM, beat y energía de graves/medios/agudos en `js/data/music-data.js`): con eso se mueven los cabezales, las guirnaldas, los bafles, los enemigos y el jefe.

**Para cambiar una canción:** reemplazá el mp3 y corré, por ejemplo: `python tools/musica.py menu "TÍTULO" assets/music/menu.mp3` (necesita ffmpeg, numpy y scipy). Después subí `NV.VERSION` en `js/core.js`.

---

## 4. Publicarlo para la fiesta

**Opción A: servidor propio (recomendada).** Subí la carpeta a cualquier servicio que corra Node (Render, Railway, Fly.io o un VPS) con el comando `npm start` y la variable `ADMIN_KEY`. Después hacés el QR con esa dirección.

**Opción B: hosting estático + Supabase.** Si lo subís a Netlify, Vercel o GitHub Pages (que no corren `server.js`):
1. Creá un proyecto en supabase.com y ejecutá `supabase.sql` completo en el SQL Editor (crea la tabla `players`, con el Instagram como clave única, y las funciones de registro y de envío de tiempos).
2. En `js/core.js` completá `SUPABASE: { url: '...', anonKey: '...' }`.
3. Los Instagram se ven en Supabase → *Table Editor* → `players`.

> **Anti-trampa:** con `server.js`, cada partida recibe un token firmado y el servidor anota la largada con su propio reloj. Rechaza tiempos que no coinciden con lo que midió él (±3 s), tiempos por debajo de `MIN_SEC` (35 s por defecto) y partidas repetidas. Con Supabase no hay esa validación: antes de entregar premios conviene revisar el Top.
>
> **Sobre el "soy yo":** no hay contraseña (es un juego de fiesta), así que confirmar un Instagram ya registrado es de buena fe. A los ganadores conviene pedirles que repitan una partida en persona.

---

## 5. Archivos

```
index.html            juego (registro + canvas)
admin.html            panel con Top 3, Instagram y descarga CSV
server.js             servidor + base de datos (sin dependencias)
supabase.sql          base de datos alternativa en Supabase
css/style.css         estilo del registro (fuente Akira 8-bit)
js/core.js            ⚙ TODOS los números del juego (vida, disparo, calor, dash, avisos del jefe, oscuridad del fondo…)
js/level.js           el mapa: dónde va cada enemigo, moneda, ítem y checkpoint
js/player.js          movimiento, disparo, animaciones y las 3 muertes
js/enemies.js         enemigos navideños y ROBO-GRINCH
js/stage.js           escenario, luces de boliche, láseres, guirnaldas, plataformas con el color del DJ
js/audio.js           canciones, beat y efectos de sonido
js/db.js              registro y ranking (servidor / Supabase / local)
js/screens.js         historia, título, elegir DJ, resultados, ranking, pausa
js/hud.js             cronómetro, vidas, monedas, barra del jefe
js/gfx.js             pantalla nítida, fuente Akira 8-bit, sprites y mezcla de cuadros
js/data/              datos generados: sprites, fuente, música, animación del menú
assets/sprites/       DJs y Robo-Grinch (de arte-fuente/ASSETS AGREGADOS) + enemigos e ítems 8-bit
assets/fonts/         akira8.ttf (Akira Expanded llevada a 8-bit)
assets/music/         canción del menú + una por DJ
tools/assets_v2.py    genera DJs, Robo-Grinch, retratos, B-Coin, cohete y plasma desde arte-fuente
tools/hojas.py        recorte de las hojas de animación (lo usa assets_v2.py)
tools/fuente.py       genera la fuente Akira 8-bit (canvas + ttf)
tools/musica.py       analiza una canción (BPM y energía)
tools/video_menu.py   convierte el video transparente del menú en cuadros para el juego
tools/arte.py         genera el arte de fondo, tiles y enemigos
```

### Atajos para probar
- `?hero=ivan` (o `hades`, `matias`): arranca directo jugando.
- `?hero=ivan&boss=1`: arranca en la puerta del jefe.
- `?debug`: muestra errores en pantalla.

---

## 6. Arte, fuente y video

- **DJs y Robo-Grinch:** salen de las hojas de `arte-fuente/ASSETS AGREGADOS`. `python tools/assets_v2.py` recorta cada cuadro, saca fondos y números, los lleva al tamaño del juego con una paleta común y arma las hojas (`assets/sprites/ivan.png`, `hades.png`, `matias.png`, `robogrinch.png`), los retratos, las caras, la tarjeta del VS y la **B-Coin** nueva. Necesita Python con Pillow, numpy y opencv.
- **Fluidez:** entre un cuadro y el siguiente el juego mezcla los dos (un cuadro intermedio "fantasma") y suma estela de movimiento en el dash; el jefe cambia de pose con una mezcla corta. Así las animaciones cuadro por cuadro se ven fluidas sin redibujar nada.
- **Fuente:** `python tools/fuente.py` genera la versión 8-bit de **Akira Expanded** (chica para textos, ancha para títulos; con acentos, Ñ y ¡ ¿ que la demo no trae). *Akira Expanded Demo es una demo: para uso comercial hay que tener la licencia de la fuente.*
- **Video del menú:** el logo es el video `assets/video/menu_logo.mp4` (copia de `SALVA LA NAVIDANCE INFINITO.mp4`, fondo negro, loop ya hecho en el video). Se reproduce como video real encima del juego, en calidad completa y con más saturación (`filter: saturate` en `css/style.css`), en loop, sin sonido y sin controles; con `mix-blend-mode: screen` el negro desaparece. Funciona en PC, Android y iPhone. Para cambiarlo, reemplazá ese archivo (fondo negro, mp4 H.264). Un `.mov` con transparencia (ProRes) no sirve: Chrome y Android no lo reproducen.
- **Cuadros intermedios del jefe:** `tools/assets_v2.py` genera un cuadro nuevo entre cada par de cuadros de las hojas con flujo óptico (doble de fluidez). Si un intermedio sale "fantasma" (movimiento demasiado grande), se descarta y ahí el juego hace una transición suave.
- **DJs:** se achican en dos pasos, con 96 colores y un contorno oscuro de 1 píxel, para que se vean nítidos al correr.
- **Parlantes robados:** la bolsa (`PARLANTES ROBADOS.jpg`) está detrás de Robo-Grinch en la arena.
- **Favicon e íconos:** la B-Coin en 8-bit (`favicon.ico`, `assets/img/favicon*.png`, `icon-192/512.png`), generados con `tools/assets_v2.py`.
- **Fondo, tiles y enemigos:** `python tools/arte.py`. Si lo corrés, después corré `python tools/assets_v2.py` (para que la B-Coin nueva no se pise).
- Después de cambiar arte o música, subí `NV.VERSION` en `js/core.js` para que los celulares no muestren lo viejo guardado en caché.
