# =====================================================================
#  GENERADOR DE ARTE 8-BIT — Salva la Navidance · BRUTAL. (9 de Julio)
#  Dibuja píxel por píxel (sin IA) el fondo de la ciudad de 9 de Julio,
#  en Navidad (nieve, luces, árbol de la plaza), los tiles, los enemigos
#  navideños, y escribe sus metadatos (el jefe Don Gruñón lo arma tools/jefe.py)
#  en js/data/art-data.js.
#
#     python tools/arte.py
#
#  Todo es determinístico (misma semilla = mismo arte). Para retocar algo,
#  cambiar la función que lo dibuja y volver a correr el script.
# =====================================================================
import json, math, os, random, re
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = os.path.join(ROOT, 'assets', 'bg')
SP = os.path.join(ROOT, 'assets', 'sprites')
IMG = os.path.join(ROOT, 'assets', 'img')

# ---------------- paleta ----------------
def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
INK = hx('0b0a12')
P = {k: hx(v) for k, v in dict(
    night0='07060f', night1='0e0b22', night2='1d1240', night3='3a1a5c', haze='5a2350',
    sil0='0d0c1c', sil1='15142c', sil2='1f1d3d', sil3='2b2852', sil4='3a3666',
    brick0='3a1d22', brick1='5a2a2a', brick2='7a3a30', brick3='9a5240',
    stone0='3c3a52', stone1='5a5878', stone2='8a88a8', stone3='c8c6dc',
    win='ffcf6a', win2='ffe9a8', tv='7ab8ff', winoff='241f3a',
    red='ff2e4a', red2='b3132b', red3='5c0815', amber='ffb347', amber2='c46a1a',
    cyan='4de2ff', cyan2='1a8fb3', pink='ff4fd8', green='33e07a', green2='157a3e',
    yellow='f5c542', yellow2='b38a1a', white='ffffff', grey0='22232e', grey1='3b3d4f',
    grey2='5d6075', grey3='8a8ea8', grey4='c2c6da', steel0='2a3040', steel1='465068',
    steel2='6a7898', steel3='9fb0cc', skin0='7a4a35', skin1='b07050', skin2='d8966a',
    black='111018', denim='1e2a48', denim2='2e3e66', tree0='0b1a14', tree1='12281d', tree2='1b3a28',
).items()}

def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def R(d, x, y, w, h, c):
    if w > 0 and h > 0: d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)
def px(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), c)
def outline(im, c=INK):
    """contorno de 1px alrededor de todo lo opaco (el sello de un sprite prolijo)"""
    src = im.copy(); W, H = im.size; a = src.load(); o = im.load()
    for y in range(H):
        for x in range(W):
            if a[x, y][3] == 0 and any(0 <= x + dx < W and 0 <= y + dy < H and a[x + dx, y + dy][3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = c
    return im
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)

# ======================================================================
#  FONDO
# ======================================================================
def sky():
    W, H = 640, 360; im = new(W, H); d = ImageDraw.Draw(im)
    stops = [(0, P['night0']), (140, P['night1']), (250, P['night2']), (330, P['night3']), (360, P['haze'])]
    for y in range(H):
        for i in range(len(stops) - 1):
            if stops[i][0] <= y <= stops[i + 1][0]:
                t = (y - stops[i][0]) / max(1, stops[i + 1][0] - stops[i][0])
                # bandas de color (dithering ordenado) para el look 8-bit
                for x in range(W):
                    tt = t + (((x + y) % 4) / 4 - 0.5) * 0.18
                    im.putpixel((x, y), lerp(stops[i][1], stops[i + 1][1], max(0, min(1, round(tt * 6) / 6))))
                break
    rnd = random.Random(9)
    for i in range(170):
        x, y = rnd.randrange(W), rnd.randrange(230); b = rnd.random()
        c = P['white'] if b > 0.92 else P['stone2'] if b > 0.6 else P['sil4']
        px(im, x, y, c)
        if b > 0.97: px(im, x - 1, y, P['stone1']); px(im, x + 1, y, P['stone1']); px(im, x, y - 1, P['stone1']); px(im, x, y + 1, P['stone1'])
    # (la luna se reemplazó por la bola de disco que dibuja el juego en js/stage.js: S.drawDisco)
    mx, my, r = -999, -999, 0
    for y in range(-r - 8, r + 9):
        for x in range(-r - 8, r + 9):
            dd = math.hypot(x, y)
            if dd <= r:
                c = P['stone3'] if (x * 0.6 - y * 0.8) < r * 0.35 else P['stone2']
                im.putpixel((mx + x, my + y), c)
            elif dd <= r + 8 and (x + y) % 2 == 0 and dd <= r + 4 + (x % 3):
                im.putpixel((mx + x, my + y), lerp(P['night1'], P['stone1'], 0.35))
    for cx, cy, cr in ():
        d.ellipse([mx + cx - cr, my + cy - cr, mx + cx + cr, my + cy + cr], fill=P['stone2'])
    # nubes finas
    for cy, cx0, ln in ((110, 40, 180), (128, 300, 140), (96, 380, 90), (150, 520, 120)):
        for k in range(ln):
            if (k * 7) % 11 < 8: px(im, cx0 + k, cy + int(math.sin(k * 0.08) * 2), lerp(P['night2'], P['stone1'], 0.25))
    im.save(os.path.join(BG, 'sky.png'))

def far():
    """Campo de la pampa, silos con grúa, tanques de agua y antenas (y=60 en pantalla)."""
    W, H = 1280, 300; im = new(W, H); d = ImageDraw.Draw(im); blink = []
    hz = 200  # horizonte
    # línea de árboles del horizonte (eucaliptos)
    rnd = random.Random(3)
    x = 0
    while x < W:
        w = rnd.randint(18, 46); h = rnd.randint(10, 26)
        d.ellipse([x, hz - h, x + w, hz + 6], fill=P['sil1']); x += w - rnd.randint(4, 12)
    R(d, 0, hz, W, H - hz, P['sil0'])
    # surcos del campo
    for y in range(hz + 6, H, 7): R(d, 0, y, W, 1, P['sil1'])
    def silos(x0, n, big):
        hh = 74 if big else 56
        for i in range(n):
            sx = x0 + i * 24
            R(d, sx, hz - hh, 22, hh, P['sil2']); R(d, sx, hz - hh, 3, hh, P['sil3'])
            d.polygon([(sx, hz - hh), (sx + 11, hz - hh - 9), (sx + 22, hz - hh)], fill=P['sil3'])
            for ry in range(hz - hh + 6, hz, 6): R(d, sx + 1, ry, 20, 1, P['sil1'])
        # grúa/elevador roja de la planta de acopio
        gx = x0 + n * 24 + 4
        R(d, gx, hz - hh - 34, 4, hh + 34, P['red3']); R(d, gx + 1, hz - hh - 34, 1, hh + 34, P['red2'])
        d.line([(gx + 2, hz - hh - 34), (x0 + 6, hz - hh - 6)], fill=P['red3'], width=2)
        R(d, gx - 3, hz - hh - 38, 10, 5, P['red2'])
        blink.append([gx + 1, hz - hh - 40])
    def tanque(x0, h):
        # tanque de agua elevado (columna de hormigón + tanque)
        R(d, x0 + 7, hz - h, 8, h, P['sil2']); R(d, x0 + 7, hz - h, 2, h, P['sil3'])
        R(d, x0, hz - h - 22, 22, 22, P['sil3']); R(d, x0, hz - h - 22, 22, 3, P['sil4'])
        R(d, x0 + 2, hz - h - 14, 18, 1, P['sil2'])
        blink.append([x0 + 10, hz - h - 25])
    def antena(x0, h):
        for k in range(h):
            if k % 6 < 3: px(im, x0 - (k // 12) % 2, hz - k, P['sil3'])
            px(im, x0, hz - k, P['sil2'])
        d.line([(x0 - 6, hz), (x0, hz - h + 10)], fill=P['sil2']); d.line([(x0 + 6, hz), (x0, hz - h + 10)], fill=P['sil2'])
        blink.append([x0 - 1, hz - h - 2])
    silos(60, 4, True); tanque(260, 44); antena(380, 96); silos(520, 3, False)
    tanque(700, 36); silos(860, 5, True); antena(1060, 70); tanque(1170, 50)
    # ruta 5 con camiones lejanos (luces)
    R(d, 0, hz + 14, W, 3, P['sil2'])
    for k in range(0, W, 160): R(d, k + 30, hz + 14, 3, 1, P['amber']); R(d, k + 36, hz + 14, 2, 1, P['red'])
    # ventanitas de casas de campo
    for k in range(40): xx = rnd.randrange(W); R(d, xx, hz - rnd.randint(2, 6), 2, 1, P['win'])
    im.save(os.path.join(BG, 'far.png'))
    return blink

def window_grid(d, x, y, w, h, rnd, cw=4, ch=5, gx=3, gy=4, lit=0.55):
    for yy in range(y + 3, y + h - ch, ch + gy):
        for xx in range(x + 3, x + w - cw, cw + gx):
            r = rnd.random()
            c = P['win'] if r < lit * 0.8 else P['tv'] if r < lit else P['winoff']
            R(d, xx, yy, cw, ch, c)
            if c == P['win']: R(d, xx, yy, cw, 1, P['win2'])

def mid():
    """Centro de 9 de Julio: catedral, palacio municipal, edificios de ladrillo, BRUTAL. (y=30)."""
    W, H = 2048, 330; im = new(W, H); d = ImageDraw.Draw(im)
    rnd = random.Random(7); bulbs = []; neon = []
    base = H
    def edificio(x, w, h, brick=True):
        top = base - h
        c0, c1, c2 = (P['brick0'], P['brick1'], P['brick2']) if brick else (P['stone0'], P['stone1'], P['stone2'])
        R(d, x, top, w, h, c1); R(d, x, top, 3, h, c2); R(d, x + w - 3, top, 3, h, c0)
        R(d, x - 1, top - 3, w + 2, 3, c0)  # cornisa
        for fy in range(top + 9, base, 9): R(d, x, fy, w, 1, c0)  # losas
        window_grid(d, x, top + 2, w, h - 4, rnd, cw=4, ch=5, gx=4, gy=4, lit=0.6)
        # tanque de agua en la terraza
        R(d, x + w // 2 - 5, top - 10, 10, 7, P['stone1']); R(d, x + w // 2 - 4, top - 3, 1, 3, P['stone0']); R(d, x + w // 2 + 3, top - 3, 1, 3, P['stone0'])
        return top
    def casa(x, w, h):
        top = base - h
        R(d, x, top, w, h, P['sil3']); R(d, x - 2, top - 4, w + 4, 4, P['sil2'])
        for wx in range(x + 4, x + w - 8, 12):
            R(d, wx, top + 8, 6, 9, P['win'] if rnd.random() < 0.6 else P['winoff']); R(d, wx - 1, top + 7, 8, 1, P['sil4'])
    def catedral(x):
        # Catedral Santo Domingo de Guzmán: nave + torre central neogótica con aguja y cruz
        R(d, x, base - 70, 90, 70, P['stone1']); R(d, x, base - 70, 90, 3, P['stone2'])
        d.polygon([(x - 2, base - 70), (x + 45, base - 96), (x + 92, base - 70)], fill=P['stone0'])
        tx = x + 33
        R(d, tx, base - 150, 24, 80, P['stone2']); R(d, tx, base - 150, 3, 80, P['stone3']); R(d, tx + 21, base - 150, 3, 80, P['stone1'])
        R(d, tx + 2, base - 176, 20, 26, P['stone2']); R(d, tx + 2, base - 176, 3, 26, P['stone3']); R(d, tx + 6, base - 172, 4, 14, P['night1']); R(d, tx + 14, base - 172, 4, 14, P['night1'])
        for k in range(3): R(d, tx + 2 + k * 8, base - 130, 4, 14, P['night1'])  # ventanales
        d.ellipse([tx + 5, base - 145, tx + 18, base - 132], fill=P['win2']); d.ellipse([tx + 7, base - 143, tx + 16, base - 134], fill=P['win'])  # reloj
        px(im, tx + 11, base - 139, INK); px(im, tx + 11, base - 140, INK); px(im, tx + 12, base - 138, INK)
        d.polygon([(tx + 1, base - 176), (tx + 12, base - 226), (tx + 23, base - 176)], fill=P['stone1'])
        d.polygon([(tx + 12, base - 226), (tx + 23, base - 176), (tx + 14, base - 176)], fill=P['stone0'])
        for k in (-1, 25): R(d, tx + k, base - 158, 2, 10, P['stone2'])  # pináculos
        for k in (1, 21): R(d, tx + k, base - 186, 2, 10, P['stone2'])
        R(d, tx + 11, base - 238, 2, 12, P['win2']); R(d, tx + 7, base - 233, 10, 2, P['win2'])  # cruz
        R(d, x + 12, base - 40, 14, 40, P['night1']); d.ellipse([x + 12, base - 47, x + 25, base - 34], fill=P['night1'])  # puerta
        R(d, x + 64, base - 40, 14, 40, P['night1']); d.ellipse([x + 64, base - 47, x + 77, base - 34], fill=P['night1'])
        bulbs.extend([[tx + 12 + int(math.cos(a) * 9), base - 139 + int(math.sin(a) * 9)] for a in [i * math.pi / 4 for i in range(8)]])
    def palacio(x):
        # Palacio Municipal: fachada italianizante con torre del reloj y cúpula
        R(d, x, base - 64, 130, 64, P['stone1']); R(d, x, base - 64, 130, 4, P['stone3']); R(d, x, base - 30, 130, 2, P['stone2'])
        for cx in range(x + 6, x + 126, 14):
            R(d, cx, base - 58, 3, 58, P['stone2'])  # columnas
            R(d, cx + 5, base - 54, 6, 12, P['win'] if rnd.random() < 0.7 else P['winoff']); d.ellipse([cx + 5, base - 57, cx + 10, base - 51], fill=P['win2'])
            R(d, cx + 5, base - 24, 6, 14, P['win'])
        t = x + 50
        R(d, t, base - 112, 30, 48, P['stone2']); R(d, t, base - 112, 30, 3, P['stone3'])
        d.ellipse([t + 6, base - 106, t + 23, base - 89], fill=P['win2']); d.ellipse([t + 8, base - 104, t + 21, base - 91], fill=P['white'])
        d.line([(t + 14, base - 97), (t + 14, base - 102)], fill=INK); d.line([(t + 14, base - 97), (t + 18, base - 97)], fill=INK)
        d.pieslice([t + 2, base - 130, t + 28, base - 100], 180, 360, fill=P['stone0'])
        R(d, t + 14, base - 136, 2, 8, P['stone2'])
        # bandera argentina
        R(d, t + 16, base - 136, 10, 2, (116, 172, 223, 255)); R(d, t + 16, base - 134, 10, 2, P['white']); R(d, t + 16, base - 132, 10, 2, (116, 172, 223, 255))
    def cartel_brutal(x, y):
        # cartel BRUTAL. en una terraza (la marca de la fiesta)
        w, h = 112, 36
        R(d, x + 10, y + h, 3, 30, P['grey1']); R(d, x + w - 13, y + h, 3, 30, P['grey1'])
        R(d, x, y, w, h, INK); R(d, x + 2, y + 2, w - 4, h - 4, (18, 10, 24, 255))
        logo = Image.open(os.path.join(IMG, 'brutal_logo.png')).convert('RGBA').resize((96, 17), Image.NEAREST)
        im.alpha_composite(logo, (x + 8, y + 10))
        R(d, x + 8, y + 29, 96, 2, P['red'])
        neon.append({'x': x, 'y': y, 'w': w, 'h': h, 'c': 'R'})
        for k in range(0, w, 8): bulbs.append([x + k + 2, y - 3])
    def letras_9dj(x):
        # letras gigantes "9 DE JULIO" de la entrada de la ciudad, iluminadas
        txt = '9 DE JULIO'; cx = x
        F = {'9': ['111', '101', '111', '001', '111'], 'D': ['110', '101', '101', '101', '110'], 'E': ['111', '100', '110', '100', '111'],
             'J': ['011', '001', '001', '101', '111'], 'U': ['101', '101', '101', '101', '111'], 'L': ['100', '100', '100', '100', '111'],
             'I': ['111', '010', '010', '010', '111'], 'O': ['111', '101', '101', '101', '111'], ' ': ['000'] * 5}
        for ch in txt:
            g = F[ch]
            for gy, row in enumerate(g):
                for gx, b in enumerate(row):
                    if b == '1': R(d, cx + gx * 5, base - 46 + gy * 5, 5, 5, P['white']); R(d, cx + gx * 5, base - 46 + gy * 5 + 4, 5, 1, P['stone1'])
            cx += 20 if ch != ' ' else 12
        R(d, x - 4, base - 18, cx - x + 4, 18, P['sil3'])
        neon.append({'x': x - 4, 'y': base - 50, 'w': cx - x + 4, 'h': 32, 'c': 'W'})
    def palmera(x):
        R(d, x, base - 60, 3, 60, P['tree1'])
        for a in range(0, 360, 45):
            ex, ey = x + 1 + int(math.cos(math.radians(a)) * 16), base - 60 + int(math.sin(math.radians(a)) * 9) + 4
            d.line([(x + 1, base - 60), (ex, ey)], fill=P['tree2'], width=2)
    def arbol(x, r):
        d.ellipse([x - r, base - r * 2 - 10, x + r, base - 10], fill=P['tree1']); d.ellipse([x - r + 3, base - r * 2 - 8, x + r - 6, base - 18], fill=P['tree2'])
        R(d, x - 1, base - 12, 3, 12, P['tree0'])
    # composición (se repite cada 2048 px)
    edificio(20, 46, 150); casa(70, 40, 40); catedral(120); arbol(230, 14); edificio(250, 52, 120)
    letras_9dj(320); edificio(470, 40, 170); cartel_brutal(458, 108); casa(520, 60, 36); palmera(590)
    palacio(610); arbol(760, 16); edificio(790, 60, 140, brick=False); casa(860, 44, 44); edificio(910, 38, 100)
    arbol(965, 12); edificio(990, 54, 160); casa(1050, 70, 40); palmera(1130); edificio(1150, 46, 128, brick=False)
    edificio(1210, 64, 186); cartel_brutal(1206, 98); casa(1280, 50, 34); arbol(1345, 15); edificio(1370, 42, 112)
    catedral(1420); casa(1520, 40, 38); edificio(1565, 56, 150); palmera(1630); edificio(1650, 40, 96, brick=False)
    arbol(1705, 13); edificio(1725, 60, 172); casa(1790, 66, 42); edificio(1860, 44, 132); arbol(1915, 16); edificio(1940, 70, 118)
    # guirnalda de lamparitas cruzando la calle
    for k in range(0, 420, 10):
        x = 1240 + k; y = 120 + int(math.sin(k / 420 * math.pi) * 22)
        px(im, x, y - 2, P['sil4']); bulbs.append([x, y])
    im.save(os.path.join(BG, 'mid.png'))
    return bulbs, neon

def near():
    """Primer plano urbano: casas con rejas, postes de luz con cables, transformadores, kiosco (y=0)."""
    W, H = 1280, 360; im = new(W, H); d = ImageDraw.Draw(im); cons = []
    base = 304; rnd = random.Random(11)
    FACH = [(46, 30, 52, 255), (34, 40, 60, 255), (56, 34, 40, 255), (30, 44, 48, 255), (50, 42, 30, 255)]
    nf = [0]
    def fachada(x, w, h, col):
        top = base - h; col = FACH[nf[0] % len(FACH)]; nf[0] += 1
        hi = tuple(min(255, c + 18) for c in col[:3]) + (255,); lo = tuple(max(0, c - 12) for c in col[:3]) + (255,)
        R(d, x, top, w, h, col); R(d, x - 2, top - 5, w + 4, 5, P['sil1']); R(d, x, top, w, 2, hi)
        for yy in range(top + 6, base, 4): R(d, x, yy, w, 1, lo)  # textura de revoque
        if nf[0] % 2: R(d, x + 4, top + 36, w - 8, 2, P['grey2']); [R(d, k, top + 30, 1, 6, P['grey2']) for k in range(x + 4, x + w - 4, 3)]  # balcón
        else:
            aw = P['red2'] if nf[0] % 4 else P['green2']
            for k in range(x + 4, x + w - 4, 6): R(d, k, base - 34, 3, 5, aw); R(d, k + 3, base - 34, 3, 5, P['white'] if aw == P['red2'] else P['sil4'])  # toldo
        R(d, x + w - 14, top + 14, 9, 6, P['grey1']); R(d, x + w - 13, top + 15, 7, 1, P['grey2'])  # aire acondicionado
        for wx in range(x + 6, x + w - 14, 22):
            R(d, wx, top + 12, 12, 18, P['win'] if rnd.random() < 0.55 else P['winoff'])
            for k in range(wx, wx + 12, 3): R(d, k, top + 12, 1, 18, P['sil0'])  # rejas
            R(d, wx - 2, top + 30, 16, 2, P['sil4'])
        R(d, x + w // 2 - 6, base - 22, 12, 22, P['sil0'])  # puerta
    def poste(x):
        R(d, x, base - 120, 3, 120, P['sil2']); R(d, x - 10, base - 118, 24, 2, P['sil2'])
        for k in (-9, 12): R(d, x + k, base - 121, 2, 3, P['grey2'])  # aisladores
        R(d, x + 3, base - 112, 16, 2, P['sil2']); R(d, x + 15, base - 112, 6, 3, P['amber'])  # farola de sodio
    def transformador(x):
        R(d, x, base - 104, 18, 22, P['steel1']); R(d, x, base - 104, 18, 2, P['steel2'])
        for k in range(3): R(d, x + 3 + k * 5, base - 100, 2, 14, P['steel0'])
        d.polygon([(x + 6, base - 98), (x + 12, base - 98), (x + 9, base - 92)], fill=P['yellow'])
    def kiosco(x):
        R(d, x, base - 46, 56, 46, P['sil2']); R(d, x - 3, base - 52, 62, 6, P['red2'])
        R(d, x + 4, base - 38, 48, 22, P['win']); R(d, x + 4, base - 38, 48, 3, P['win2'])
        cons.append([x + 8, base - 50, 40, 3])
    fachada(0, 120, 70, P['sil2']); poste(130); fachada(150, 90, 58, P['sil3']); kiosco(250)
    transformador(318); poste(330); fachada(340, 140, 76, P['sil2']); poste(500); fachada(520, 100, 62, P['sil3'])
    kiosco(630); poste(700); transformador(688); fachada(720, 130, 72, P['sil2']); poste(860); fachada(880, 110, 64, P['sil3'])
    fachada(1000, 150, 80, P['sil2']); poste(1160); transformador(1148); fachada(1170, 110, 60, P['sil3'])
    # cables entre postes (se usan como pista visual del Apagón)
    postes = [130, 330, 500, 700, 860, 1160, 1410]
    for a, b in zip(postes, postes[1:]):
        for k in range(a, min(b, W)):
            t = (k - a) / (b - a); y = base - 118 + int(math.sin(t * math.pi) * 14)
            px(im, k, y, P['sil1'])
    # vereda
    R(d, 0, base, W, H - base, P['sil0'])
    im.save(os.path.join(BG, 'near.png'))
    return cons

def tiles():
    """11 tiles de 16px: 0-2 tope del escenario, 3-5 relleno, 6 tarima de andamio, 7 relleno profundo, 9 road case BRUTAL."""
    im = new(176, 16); d = ImageDraw.Draw(im)
    def top(i, led):
        x = i * 16
        R(d, x, 0, 16, 16, P['steel0']); R(d, x, 0, 16, 2, P['steel3']); R(d, x, 2, 16, 1, P['steel2'])
        for k in range(0, 16, 4): R(d, x + k, 4, 2, 2, P['red'] if led == 'r' else P['amber']); R(d, x + k, 4, 2, 1, P['white'] if k % 8 == 0 else P['amber'])
        R(d, x, 7, 16, 1, INK); R(d, x + 2, 10, 2, 2, P['steel1']); R(d, x + 12, 10, 2, 2, P['steel1'])
    top(0, 'r'); top(1, 'a')
    x = 32; top(2, 'r'); R(d, x + 4, 9, 8, 5, P['red2']); R(d, x + 6, 10, 4, 3, P['white'])  # placa "B."
    def fill(i, kind):
        x = i * 16; R(d, x, 0, 16, 16, P['steel0'])
        R(d, x, 0, 16, 1, P['steel1']); R(d, x, 0, 1, 16, P['steel1'])
        if kind == 'x': d.line([(x + 1, 1), (x + 14, 14)], fill=P['grey1']); d.line([(x + 14, 1), (x + 1, 14)], fill=P['grey1'])
        if kind == 'v':
            for k in range(3, 13, 3): R(d, x + 3, k, 10, 1, INK)
        if kind == 'l': R(d, x + 6, 6, 4, 4, P['red3']); R(d, x + 7, 7, 2, 2, P['red'])
    fill(3, 'x'); fill(4, 'v'); fill(5, 'l')
    x = 96  # tarima de andamio (one-way)
    R(d, x, 0, 16, 4, P['steel2']); R(d, x, 0, 16, 1, P['steel3']); R(d, x, 4, 16, 1, INK)
    for k in (1, 13): R(d, x + k, 5, 2, 11, P['steel1'])
    d.line([(x + 3, 6), (x + 12, 15)], fill=P['steel1'])
    x = 112; R(d, x, 0, 16, 16, (14, 13, 24, 255)); R(d, x, 0, 16, 1, P['steel0'])
    fill(8, 'x')
    x = 144  # road case (caja de sonido) con stencil B.
    R(d, x, 0, 16, 16, P['black']); R(d, x, 0, 16, 1, P['grey2'])
    for cx, cy in ((0, 0), (12, 0), (0, 12), (12, 12)): R(d, x + cx, cy, 4, 4, P['grey3']); R(d, x + cx + 1, cy + 1, 2, 2, P['grey2'])
    R(d, x + 5, 4, 2, 8, P['red']); R(d, x + 7, 4, 3, 2, P['red']); R(d, x + 7, 7, 3, 2, P['red']); R(d, x + 7, 10, 3, 2, P['red']); R(d, x + 10, 5, 1, 2, P['red']); R(d, x + 10, 8, 1, 2, P['red']); R(d, x + 11, 11, 1, 1, P['red'])
    x = 160; R(d, x, 6, 16, 4, P['amber2'])
    im.save(os.path.join(BG, 'tiles.png'))

def deco_neumaticos():
    """reemplaza la pila de nieve: neumáticos de carrera (Autódromo 9 de Julio)"""
    im = new(32, 10); d = ImageDraw.Draw(im)
    for i, (x, y) in enumerate(((1, 4), (11, 4), (21, 4), (6, 0), (16, 0))):
        d.ellipse([x, y, x + 9, y + 5], fill=P['black']); d.ellipse([x + 2, y + 1, x + 7, y + 4], fill=P['grey0'])
        R(d, x + 3, y, 4, 1, P['red'] if i % 2 else P['white'])
    im.save(os.path.join(BG, 'deco_snow.png'))

# ======================================================================
#  ENEMIGOS (mismos tamaños de cuadro que usa el código)
# ======================================================================

# ======================================================================
#  NAVIDAD: nieve en los techos, luces, árbol de la plaza, trineo
# ======================================================================
SNOW, SNOW2, ICE = hx('f4f8ff'), hx('c8d8f0'), hx('9fc4ee')
XMAS = [hx('ff2e4a'), hx('33e07a'), hx('f5c542'), hx('4de2ff'), hx('ff4fd8')]

def nevar(path, grosor=3, min_run=3):
    """pone nieve sobre todas las superficies horizontales de una capa (techos, cornisas, silos)"""
    im = Image.open(path).convert('RGBA'); W, H = im.size; a = im.load()
    tops = []
    for x in range(W):
        for y in range(1, H):
            if a[x, y][3] > 0 and a[x, y - 1][3] == 0 and y + 2 < H and a[x, y + 1][3] > 0 and a[x, y + 2][3] > 0:
                # superficie (2 px de espesor como mínimo: los cables no juntan nieve): hay opaco a los costados en la misma fila
                if sum(1 for dx in range(-min_run // 2 - 1, min_run // 2 + 2) if 0 <= x + dx < W and a[x + dx, y][3] > 0) >= min_run:
                    tops.append((x, y))
    rnd = random.Random(5)
    for x, y in tops:
        g = grosor + (1 if (x * 7 + y) % 5 == 0 else 0)
        for k in range(g):
            if y - k - 1 >= 0: a[x, y - k - 1] = SNOW if k < g - 1 else SNOW2
        if rnd.random() < 0.06 and y + 3 < H:  # carámbanos
            for k in range(rnd.randint(2, 4)):
                if a[x, y + k][3] > 0: a[x, y + k] = ICE
    im.save(path)

def luces_techos(path, base_y=0, every=6, extra=None):
    """guirnaldas de lamparitas siguiendo el borde de los techos; devuelve posiciones para que titilen"""
    im = Image.open(path).convert('RGBA'); W, H = im.size; a = im.load(); out = []
    for x in range(2, W - 2, every):
        for y in range(1, H - 6):
            if a[x, y][3] > 0 and a[x, y - 1][3] == 0 and a[x, y][:3] in (SNOW[:3], SNOW2[:3]):
                yy = y + 5
                if yy < H and a[x, yy][3] > 0: out.append([x, yy])
                break
    return out

def arbol_plaza(d, im, x, base, h=150):
    """árbol de Navidad gigante de la plaza, con estrella y adornos"""
    for k in range(6):
        w = 16 + k * 14; y0 = base - h + 18 + k * 22
        d.polygon([(x, y0 - 18), (x - w // 2 - 10, y0 + 22), (x + w // 2 + 10, y0 + 22)], fill=P['tree1'])
        d.polygon([(x, y0 - 18), (x - w // 2 - 10, y0 + 22), (x - w // 4, y0 + 22)], fill=P['tree2'])
    R(d, x - 5, base - 14, 10, 14, P['brick1'])
    star = [(x, base - h - 10), (x + 3, base - h - 3), (x + 10, base - h - 3), (x + 4, base - h + 2), (x + 7, base - h + 9), (x, base - h + 5), (x - 7, base - h + 9), (x - 4, base - h + 2), (x - 10, base - h - 3), (x - 3, base - h - 3)]
    d.polygon(star, fill=P['yellow']); d.polygon(star[:5], fill=hx('fff1a8'))
    bulbs = []
    rnd = random.Random(x)
    for k in range(40):
        t = rnd.random(); yy = base - h + 10 + t * (h - 30); ww = (yy - (base - h)) * 0.42
        xx = x + rnd.uniform(-ww, ww); bulbs.append([int(xx), int(yy)])
    return bulbs

def trineo(im, d, x, y):
    """silueta del trineo con renos cruzando la luna"""
    c = hx('0b0a18')
    R(d, x, y + 4, 14, 4, c); d.line([(x - 2, y + 8), (x + 16, y + 8)], fill=c); R(d, x + 2, y, 4, 4, c)
    for k in range(3):
        rx = x + 20 + k * 11
        R(d, rx, y + 2, 8, 3, c); R(d, rx + 1, y + 5, 1, 3, c); R(d, rx + 6, y + 5, 1, 3, c); R(d, rx + 7, y - 1, 2, 3, c)
        px(im, rx + 9, y - 3, c); px(im, rx + 7, y - 3, c)
        d.line([(rx - 3, y + 3), (rx, y + 3)], fill=c)
    px(im, x + 54, y, P['red'])  # nariz roja

def navidad_fondo():
    sky_p = os.path.join(BG, 'sky.png'); im = Image.open(sky_p).convert('RGBA'); d = ImageDraw.Draw(im)
    im.save(sky_p)  # (el trineo cruzaba la luna: ahora hay una bola de disco)
    for name in ('far', 'near'): nevar(os.path.join(BG, name + '.png'), 3 if name != 'far' else 2)
    # árbol gigante en la plaza (capa media) + luces en los techos
    mp = os.path.join(BG, 'mid.png'); im = Image.open(mp).convert('RGBA'); d = ImageDraw.Draw(im)
    b1 = arbol_plaza(d, im, 400, 330, 150); b2 = arbol_plaza(d, im, 1585, 330, 130); im.save(mp)
    nevar(mp, 3)
    techos = luces_techos(mp, every=7)
    # coronas navideñas en las ventanas del primer plano
    np_ = os.path.join(BG, 'near.png'); im = Image.open(np_).convert('RGBA'); d = ImageDraw.Draw(im)
    for x in range(40, 1280, 110):
        d.ellipse([x, 236, x + 11, 247], fill=P['green2']); d.ellipse([x + 3, 239, x + 8, 244], fill=(0, 0, 0, 0)); R(d, x + 4, 245, 4, 3, P['red'])
    im.save(np_)
    return b1 + b2 + techos

# ======================================================================
#  ENEMIGOS NAVIDEÑOS (mismos tamaños de cuadro que usa el código)
# ======================================================================
def sheet(frames):
    w, h = frames[0].size; s = new(w * len(frames), h)
    for i, f in enumerate(frames): s.alpha_composite(f, (i * w, 0))
    return s

def patovica(f):
    """Muñeco Patovica: muñeco de nieve patovica de BRUTAL., anteojos negros, cucaracha y gorro negro. Salta al beat."""
    im = new(30, 34); d = ImageDraw.Draw(im); oy = 1 if f else 0
    d.ellipse([3, 15, 26, 33], fill=SNOW); d.ellipse([3, 15, 10, 33], fill=SNOW2)  # cuerpo
    for k in (19, 24, 29): R(d, 14, k, 2, 2, P['black'])  # botones de carbón
    d.ellipse([7, 4 + oy, 22, 18 + oy], fill=SNOW); d.ellipse([7, 4 + oy, 12, 18 + oy], fill=SNOW2)  # cabeza
    R(d, 7, 9 + oy, 16, 3, INK); R(d, 8, 9 + oy, 5, 1, P['cyan']); R(d, 16, 9 + oy, 5, 1, P['cyan'])  # anteojos
    R(d, 15, 12 + oy, 6, 2, P['amber'])  # nariz de zanahoria
    R(d, 12, 15 + oy, 6, 1, P['grey1'])
    R(d, 7, 1 + oy, 16, 5, P['black']); R(d, 6, 5 + oy, 18, 2, P['grey1']); R(d, 13, 2 + oy, 4, 2, P['red'])  # gorro con la B.
    R(d, 22, 9 + oy, 1, 6, P['grey3'])  # cucaracha
    R(d, 6, 16, 18, 3, P['red']); R(d, 18, 16, 4, 8, P['red2'])  # bufanda
    if f == 0:  # brazos de rama cruzados
        d.line([(4, 22), (25, 25)], fill=P['brick1'], width=2); d.line([(4, 25), (25, 22)], fill=P['brick1'], width=2)
    else:
        d.line([(5, 20), (0, 10)], fill=P['brick1'], width=2); d.line([(24, 20), (29, 10)], fill=P['brick1'], width=2)
        px(im, 0, 9, P['brick2']); px(im, 29, 9, P['brick2'])
    return outline(im)

def regalo(f):
    """Regalo Poseído: caja con moño, ojos que espían por la tapa y un cañón de cotillón que tira bastones de caramelo."""
    im = new(30, 44); d = ImageDraw.Draw(im)
    lid = 3 if f == 3 else (1 if f in (1, 2) else 0)
    R(d, 4, 16, 22, 26, P['red']); R(d, 4, 16, 3, 26, hx('ff6a7e')); R(d, 23, 16, 3, 26, P['red2'])
    R(d, 13, 16, 4, 26, P['yellow']); R(d, 13, 16, 1, 26, hx('fff1a8'))  # cinta
    for k in range(18, 42, 6): px(im, 8, k, hx('ff9aa8')); px(im, 20, k + 3, hx('ff9aa8'))  # estampado
    R(d, 2, 10 - lid, 26, 7, P['red2']); R(d, 2, 10 - lid, 26, 2, P['red']); R(d, 13, 10 - lid, 4, 7, P['yellow2'])  # tapa
    d.ellipse([7, 2 - lid, 14, 9 - lid], fill=P['yellow']); d.ellipse([16, 2 - lid, 23, 9 - lid], fill=P['yellow']); R(d, 13, 5 - lid, 4, 4, P['yellow2'])  # moño
    eye = P['red'] if f == 2 else P['yellow']
    R(d, 4, 17, 22, 3 + lid, INK)
    if lid: R(d, 8, 17, 3, 2, eye); R(d, 19, 17, 3, 2, eye)
    R(d, 26, 24, 3, 6, P['green2']); R(d, 28, 22, 2, 10, P['green'])  # cañón de cotillón
    if f == 3: R(d, 29, 25, 1, 4, P['white']); px(im, 29, 21, P['yellow']); px(im, 29, 32, P['yellow'])
    R(d, 7, 42, 5, 2, P['black']); R(d, 18, 42, 5, 2, P['black'])  # patitas
    return outline(im)

def esfera(f):
    """Esfera Maldita: bola del árbol que vuela con alitas de murciélago y un ojo que brilla."""
    im = new(30, 28); d = ImageDraw.Draw(im)
    wy = [4, 10, 15][f]
    d.polygon([(9, 13), (0, wy), (2, 17), (6, 15)], fill=P['grey1']); d.polygon([(21, 13), (30, wy), (28, 17), (24, 15)], fill=P['grey1'])
    d.ellipse([7, 6, 23, 22], fill=P['green']); d.ellipse([7, 6, 13, 22], fill=hx('7cff9e')); d.ellipse([18, 8, 23, 20], fill=P['green2'])
    R(d, 7, 13, 16, 2, P['yellow']); [px(im, k, 13, P['white']) for k in range(8, 23, 4)]  # cinta dorada
    R(d, 12, 3, 6, 4, P['grey3']); R(d, 13, 2, 4, 1, P['grey4']); px(im, 15, 1, P['grey2'])  # capuchón
    d.ellipse([12, 15, 18, 21], fill=INK); R(d, 14, 17, 2, 2, P['red'] if f != 1 else hx('ffd0d6'))
    px(im, 9, 9, P['white'])
    return outline(im)

def duende(f):
    """Duende Travieso: gorro verde con cascabel, orejas puntiagudas y una bola de Navidad para tirar."""
    im = new(24, 30); d = ImageDraw.Draw(im)
    jump = f == 2
    if jump: R(d, 7, 22, 4, 4, P['green2']); R(d, 13, 22, 4, 4, P['red'])
    else:
        R(d, 7, 23, 4, 5, P['green2']); R(d, 13, 23, 4, 5, P['red'])
        R(d, 5, 27, 6, 2, P['brick1']); R(d, 13, 27, 6, 2, P['brick1']); px(im, 5, 26, P['brick1']); px(im, 18, 26, P['brick1'])  # zapatos curvos
    R(d, 6, 14, 12, 10, P['green']); R(d, 6, 14, 12, 1, hx('7cff9e')); R(d, 6, 20, 12, 2, P['brick1']); R(d, 11, 20, 2, 2, P['yellow'])  # cinturón
    for k in range(6, 18, 2): px(im, k, 24, P['red'])  # dobladillo en zigzag
    R(d, 8, 7, 9, 8, P['skin2']); R(d, 5, 9, 3, 2, P['skin2']); R(d, 17, 9, 3, 2, P['skin2']); px(im, 4, 8, P['skin2']); px(im, 20, 8, P['skin2'])  # cara y orejas
    R(d, 9, 10, 2, 2, INK); R(d, 14, 10, 2, 2, INK); px(im, 10, 10, P['red']); px(im, 15, 10, P['red'])
    R(d, 10, 13, 5, 1, P['skin0']); px(im, 9, 12, P['skin0']); px(im, 15, 12, P['skin0'])  # sonrisa malvada
    d.polygon([(7, 8), (18, 8), (22, 1), (14, 3)], fill=P['green']); R(d, 7, 7, 11, 2, SNOW)  # gorro
    d.ellipse([20, 0, 23, 3], fill=P['yellow'])  # cascabel
    if f == 1: R(d, 17, 5, 3, 9, P['green']); d.ellipse([16, 0, 22, 6], fill=P['red']); px(im, 17, 1, P['white'])
    else: R(d, 3, 15, 3, 6, P['green']); R(d, 18, 15, 3, 6, P['green']); d.ellipse([18, 19, 23, 24], fill=P['red'])
    return outline(im)

def bola(f):
    """bola de Navidad bomba (roja / verde) con mecha"""
    im = new(10, 11); d = ImageDraw.Draw(im)
    col = P['red'] if f < 2 else P['green']; dark = P['red2'] if f < 2 else P['green2']
    R(d, 3, 1, 4, 2, P['yellow']); d.ellipse([1, 3, 8, 10], fill=col); d.ellipse([2, 4, 4, 6], fill=P['white']); R(d, 6, 8, 2, 2, dark)
    R(d, 2, 6, 6, 1, P['yellow'])
    sp = (4, 0) if f % 2 == 0 else (6, 0)
    px(im, sp[0], sp[1], P['yellow']); px(im, sp[0] + 1, sp[1], P['white'])
    return im

def onda_nieve(f):
    """onda de nieve y hielo del pisotón del jefe"""
    im = new(20, 16); d = ImageDraw.Draw(im)
    for k in range(0, 20, 4):
        h = 6 + ((k // 4 + f) % 3) * 3
        d.polygon([(k, 16), (k + 2, 16 - h), (k + 4, 16)], fill=ICE); R(d, k + 1, 16 - h + 2, 1, h - 3, SNOW)
    return im

def baston():
    """bastón de caramelo (disparo del Regalo Poseído)"""
    im = new(12, 4); d = ImageDraw.Draw(im)
    for k in range(12): R(d, k, 0, 1, 4, P['red'] if (k // 2) % 2 else SNOW)
    R(d, 0, 0, 12, 1, P['white']); return im

def disparo(col, light):
    """disparo del DJ: estrella navideña de energía (2 cuadros)"""
    fr = []
    for f in range(2):
        im = new(14, 8); d = ImageDraw.Draw(im)
        R(d, 0, 3, 8, 2, col); R(d, 2, 3, 6, 2, light)
        cx, cy = 10, 4
        pts = [(cx, cy - 4), (cx + 1, cy - 1), (cx + 4, cy), (cx + 1, cy + 1), (cx, cy + 4), (cx - 1, cy + 1), (cx - 4, cy), (cx - 1, cy - 1)] if f == 0 else \
              [(cx - 3, cy - 3), (cx, cy - 1), (cx + 3, cy - 3), (cx + 1, cy), (cx + 3, cy + 3), (cx, cy + 1), (cx - 3, cy + 3), (cx - 1, cy)]
        d.polygon(pts, fill=light); px(im, cx, cy, P['white'])
        fr.append(im)
    return sheet(fr)

# ======================================================================
#  JEFE: MECHA-NOEL (150x132, 6 cuadros)
#   Papá Noel robot gigante (folclore, diseño propio). Lentes = láseres,
#   hebilla del cinturón = núcleo que brilla en el descanso.
#   0-1 quieto · 2 apunta · 3 dispara ("¡JO JO JO!") · 4 pisotón · 5 vencido
# ======================================================================
LENS_L, LENS_R, CORE = (60, 40), (84, 40), (75, 92)
def noel(f):
    im = new(150, 132); d = ImageDraw.Draw(im)
    oy = 2 if f == 1 else 0; dead = f == 5
    RED, RED2, RED3, FUR = P['red'], P['red2'], P['red3'], SNOW
    # botas
    for bx_ in (40, 86):
        R(d, bx_, 114, 26, 18, P['black']); R(d, bx_, 114, 26, 3, P['grey1']); R(d, bx_ - 2, 128, 30, 4, P['grey0'])
        R(d, bx_, 108, 26, 6, FUR)
    # cuerpo/panza
    d.ellipse([28, 52 + oy, 124, 118], fill=RED); d.ellipse([28, 52 + oy, 60, 118], fill=hx('ff6a7e')); d.ellipse([100, 60 + oy, 124, 116], fill=RED2)
    for k in range(40, 116, 12): R(d, k, 70 + oy, 3, 3, RED3)  # remaches de la armadura
    R(d, 72, 54 + oy, 8, 52, FUR)  # piel del centro
    # cinturón + hebilla (núcleo)
    R(d, 30, 86 + oy, 92, 12, P['black']); R(d, 30, 86 + oy, 92, 2, P['grey1'])
    cx, cy = CORE[0], CORE[1] + oy
    R(d, cx - 11, cy - 8, 22, 16, P['yellow']); R(d, cx - 7, cy - 4, 14, 8, P['black'] if not dead else P['grey1']); R(d, cx - 11, cy - 8, 22, 2, hx('fff1a8'))
    # brazos mecánicos
    arm_up = f == 4
    for side, sx in ((-1, 32), (1, 120)):
        sy = 66 + oy; ex = sx + side * 16; ey = (sy - 52) if (arm_up and side == 1) else (sy + 30)
        d.line([(sx, sy), (ex, ey)], fill=INK, width=12); d.line([(sx, sy), (ex, ey)], fill=RED, width=9); d.line([(sx, sy), (ex, ey)], fill=hx('ff6a7e'), width=2)
        d.ellipse([ex - 8, ey - 4, ex + 8, ey + 10], fill=FUR)  # puño de piel / guante
        d.ellipse([ex - 7, ey + 2, ex + 7, ey + 14], fill=P['black']); R(d, ex - 4, ey + 4, 8, 2, P['grey2'])
    if arm_up:  # bolsa de regalos en alto
        d.ellipse([124, 0, 150, 22], fill=P['brick2']); R(d, 134, 18, 6, 4, P['yellow'])
    # barba de placas metálicas
    hx0, hy0 = 48, 18 + oy
    d.polygon([(hx0 - 2, hy0 + 30), (hx0 + 54, hy0 + 30), (hx0 + 46, hy0 + 52), (hx0 + 26, hy0 + 60), (hx0 + 6, hy0 + 52)], fill=SNOW)
    for k in range(hx0, hx0 + 52, 6): R(d, k, hy0 + 34, 1, 14, SNOW2)
    # cara de acero
    R(d, hx0, hy0 + 8, 52, 26, P['steel2']); R(d, hx0, hy0 + 8, 52, 3, P['steel3']); R(d, hx0 + 49, hy0 + 8, 3, 26, P['steel1'])
    # anteojos/lentes láser (rojo y verde, colores navideños)
    for i, (lx, ly) in enumerate((LENS_L, LENS_R)):
        ly2 = ly + oy
        d.ellipse([lx - 9, ly2 - 8, lx + 9, ly2 + 8], fill=INK); d.ellipse([lx - 7, ly2 - 6, lx + 7, ly2 + 6], fill=P['grey1'])
        if dead:
            d.line([(lx - 4, ly2 - 3), (lx + 4, ly2 + 3)], fill=P['grey3'], width=2); d.line([(lx + 4, ly2 - 3), (lx - 4, ly2 + 3)], fill=P['grey3'], width=2); continue
        col = P['white'] if f == 3 else (P['red'] if i == 0 else P['green'])
        rr = 5 if f in (2, 3) else 4
        d.ellipse([lx - rr, ly2 - rr + 1, lx + rr, ly2 + rr - 1], fill=col)
        if f == 2: d.ellipse([lx - 7, ly2 - 6, lx + 7, ly2 + 6], outline=P['white'])
        px(im, lx - 2, ly2 - 2, P['white'])
    R(d, 69, 40 + oy, 6, 2, INK)  # puente de los anteojos
    R(d, 69, 46 + oy, 6, 5, hx('ff9aa8'))  # nariz
    # bigote y boca
    d.ellipse([56, 50 + oy, 74, 57 + oy], fill=SNOW); d.ellipse([70, 50 + oy, 88, 57 + oy], fill=SNOW)
    if f in (3, 4): R(d, 64, 56 + oy, 16, 6, INK); R(d, 66, 57 + oy, 12, 2, P['red'])
    # gorro con pompón
    d.polygon([(hx0 - 4, hy0 + 10), (hx0 + 56, hy0 + 10), (hx0 + 70, hy0 - 12), (hx0 + 30, hy0 - 16)], fill=RED)
    d.polygon([(hx0 + 30, hy0 - 16), (hx0 + 70, hy0 - 12), (hx0 + 56, hy0 + 10)], fill=RED2)
    R(d, hx0 - 6, hy0 + 6, 64, 8, FUR); R(d, hx0 - 6, hy0 + 12, 64, 2, SNOW2)
    d.ellipse([hx0 + 64, hy0 - 20, hx0 + 78, hy0 - 6], fill=FUR)
    if dead:
        for k in range(6): d.ellipse([58 + k * 6, 2 + (k % 2) * 4, 68 + k * 6, 12 + (k % 2) * 4], fill=P['grey1'])
    return outline(im)

def noel_card():
    """retrato del jefe para la presentación VS"""
    W, H = 404, 390; im = Image.new('RGBA', (W, H), P['night0']); d = ImageDraw.Draw(im)
    for y in range(H): R(d, 0, y, W, 1, lerp(P['night0'], P['red3'], y / H * 0.9))
    rnd = random.Random(2)
    for k in range(120): x, y = rnd.randrange(W), rnd.randrange(H); R(d, x, y, 2, 2, SNOW)
    boss = noel(3).resize((150 * 3, 132 * 3), Image.NEAREST)
    im.alpha_composite(boss, (W // 2 - boss.width // 2 + 10, H - boss.height + 20))
    im.convert('RGB').save(os.path.join(IMG, 'noel_card.png'))

# ======================================================================
#  DECORACIÓN NAVIDEÑA (se pueden pisar los bafles y las consolas)
# ======================================================================
def deco_navidad():
    # bafle con moño y nieve arriba (32x64: 4 tiles, tiene tarima)
    im = new(32, 64); d = ImageDraw.Draw(im)
    R(d, 1, 4, 30, 60, P['black']); R(d, 1, 4, 30, 2, P['grey2'])
    for cy, r in ((22, 9), (46, 12)):
        d.ellipse([16 - r, cy - r, 15 + r, cy + r], fill=P['grey1']); d.ellipse([16 - r + 3, cy - r + 3, 15 + r - 3, cy + r - 3], fill=P['grey0']); R(d, 15, cy - 1, 2, 2, P['grey3'])
    R(d, 14, 4, 4, 60, P['red']); R(d, 0, 0, 32, 5, SNOW); R(d, 0, 4, 32, 1, SNOW2)
    d.ellipse([8, 0, 15, 6], fill=P['red']); d.ellipse([17, 0, 24, 6], fill=P['red'])
    im.save(os.path.join(BG, 'deco_speaker.png'))
    # consola de DJ con gorro navideño (32x32, tiene tarima)
    im = new(32, 32); d = ImageDraw.Draw(im)
    R(d, 0, 6, 32, 26, P['steel0']); R(d, 0, 6, 32, 2, P['steel2']); R(d, 3, 10, 26, 10, (40, 16, 20, 255))
    for k, c in enumerate((P['cyan'], P['green'], P['red'], P['yellow'])): R(d, 4 + k * 7, 24, 4, 3, c)
    R(d, 0, 2, 32, 5, SNOW)
    d.polygon([(20, 2), (30, 2), (32, -6)], fill=P['red'])
    im.save(os.path.join(BG, 'deco_console.png'))
    # pila de nieve con bastón de caramelo
    im = new(32, 10); d = ImageDraw.Draw(im)
    d.ellipse([0, 2, 31, 18], fill=SNOW); d.ellipse([0, 2, 12, 18], fill=SNOW2)
    for k in range(7): R(d, 22, k, 2, 1, P['red'] if k % 2 else SNOW)
    R(d, 22, 0, 4, 1, P['red']); R(d, 25, 1, 1, 2, P['red'])
    im.save(os.path.join(BG, 'deco_snow.png'))
    # pino con estrella, guirnaldas y nieve
    im = new(30, 46); d = ImageDraw.Draw(im)
    for k in range(3):
        y0 = 6 + k * 11; w = 8 + k * 6
        d.polygon([(15, y0), (15 - w, y0 + 16), (15 + w, y0 + 16)], fill=P['green2']); d.polygon([(15, y0), (15 - w, y0 + 16), (15 - w // 3, y0 + 16)], fill=P['green'])
        R(d, 15 - w + 2, y0 + 14, w * 2 - 4, 2, SNOW)
    R(d, 12, 40, 6, 6, P['brick1'])
    d.polygon([(15, 0), (17, 4), (21, 4), (18, 7), (19, 11), (15, 8), (11, 11), (12, 7), (9, 4), (13, 4)], fill=P['yellow'])
    im.save(os.path.join(BG, 'deco_tree.png'))
    # farola con corona
    im = new(12, 52); d = ImageDraw.Draw(im)
    R(d, 5, 6, 2, 46, P['grey1']); R(d, 2, 0, 8, 7, P['grey2']); R(d, 3, 2, 6, 4, hx('fff3c4')); R(d, 2, 0, 8, 2, SNOW)
    d.ellipse([1, 16, 10, 25], fill=P['green2']); d.ellipse([4, 19, 7, 22], fill=(0, 0, 0, 0)); R(d, 4, 24, 4, 3, P['red'])
    for k in range(10, 52, 6): R(d, 5, k, 2, 3, P['red'])  # poste rayado como bastón
    im.save(os.path.join(BG, 'deco_lamp.png'))
    # portón del jefe: regalo gigante
    im = new(40, 96); d = ImageDraw.Draw(im)
    R(d, 0, 6, 40, 90, P['red2']); R(d, 0, 6, 3, 90, P['red']); R(d, 17, 6, 6, 90, P['yellow']); R(d, 0, 46, 40, 6, P['yellow'])
    d.ellipse([6, 0, 19, 10], fill=P['yellow']); d.ellipse([21, 0, 34, 10], fill=P['yellow']); R(d, 0, 4, 40, 3, SNOW)
    im.save(os.path.join(BG, 'deco_door.png'))
    # truss con guirnalda
    im = new(32, 12); d = ImageDraw.Draw(im)
    R(d, 0, 0, 32, 2, P['grey2']); R(d, 0, 10, 32, 2, P['grey2'])
    for k in range(0, 32, 8): d.line([(k, 1), (k + 4, 10), (k + 8, 1)], fill=P['grey1'])
    for k in range(0, 32, 2): px(im, k, 4 + int(math.sin(k / 32 * math.pi) * 4), P['green2'])
    im.save(os.path.join(BG, 'deco_truss.png'))

def tiles_navidad():
    """tiles con nieve y carámbanos, LEDs navideños, tarima de madera con guirnalda y cajas de regalo"""
    im = new(176, 16); d = ImageDraw.Draw(im)
    def top(i, cols):
        x = i * 16
        R(d, x, 0, 16, 16, P['steel0']); R(d, x, 3, 16, 1, P['steel2'])
        for k in range(0, 16, 4): R(d, x + k, 6, 2, 2, cols[(k // 4 + i) % len(cols)])
        R(d, x, 9, 16, 1, INK); R(d, x + 2, 12, 2, 2, P['steel1']); R(d, x + 12, 12, 2, 2, P['steel1'])
        R(d, x, 0, 16, 3, SNOW); R(d, x, 3, 16, 1, SNOW2)
        for k in ((x + 3) % 7, (x + 11) % 13):  # carámbanos
            R(d, x + k, 4, 1, 2, ICE)
    top(0, [P['red'], P['green']]); top(1, [P['yellow'], P['red']])
    top(2, [P['green'], P['yellow']]); R(d, 36, 10, 8, 5, P['red2']); R(d, 38, 11, 4, 3, P['white'])
    def fill(i, kind):
        x = i * 16; R(d, x, 0, 16, 16, P['steel0']); R(d, x, 0, 16, 1, P['steel1']); R(d, x, 0, 1, 16, P['steel1'])
        if kind == 'x': d.line([(x + 1, 1), (x + 14, 14)], fill=P['grey1']); d.line([(x + 14, 1), (x + 1, 14)], fill=P['grey1'])
        if kind == 'v':
            for k in range(3, 13, 3): R(d, x + 3, k, 10, 1, INK)
        if kind == 'l': R(d, x + 6, 6, 4, 4, P['green2']); R(d, x + 7, 7, 2, 2, P['green'])
    fill(3, 'x'); fill(4, 'v'); fill(5, 'l')
    x = 96  # tarima de madera con nieve y guirnalda (se atraviesa desde abajo)
    R(d, x, 1, 16, 4, P['brick2']); R(d, x, 1, 16, 1, P['brick3']); R(d, x, 5, 16, 1, INK); R(d, x, 0, 16, 2, SNOW)
    for k in range(0, 16, 2): px(im, x + k, 7 + (k % 4 == 0), P['green2'])
    px(im, x + 4, 8, P['red']); px(im, x + 12, 8, P['yellow'])
    x = 112; R(d, x, 0, 16, 16, (14, 13, 24, 255)); R(d, x, 0, 16, 1, P['steel0'])
    fill(8, 'x')
    x = 144  # caja de regalo
    R(d, x, 0, 16, 16, P['green2']); R(d, x, 0, 16, 1, P['green']); R(d, x, 0, 1, 16, P['green'])
    R(d, x + 7, 0, 2, 16, P['yellow']); R(d, x, 7, 16, 2, P['yellow']); px(im, x + 7, 0, hx('fff1a8'))
    x = 160; R(d, x, 6, 16, 4, P['amber2'])
    im.save(os.path.join(BG, 'tiles.png'))

# ======================================================================
def main():
    os.makedirs(BG, exist_ok=True)
    sky(); fb = far(); mb, mn = mid(); nc = near()
    xmas_bulbs = navidad_fondo(); tiles_navidad(); deco_navidad()
    sheet([patovica(0), patovica(1)]).save(os.path.join(SP, 'patovica.png'))
    sheet([regalo(i) for i in range(4)]).save(os.path.join(SP, 'regalo.png'))
    sheet([esfera(i) for i in range(3)]).save(os.path.join(SP, 'esfera.png'))
    sheet([duende(i) for i in range(3)]).save(os.path.join(SP, 'duende.png'))
    sheet([bola(i) for i in range(4)]).save(os.path.join(SP, 'ornament.png'))
    sheet([onda_nieve(i) for i in range(2)]).save(os.path.join(SP, 'wave.png'))
    baston().save(os.path.join(SP, 'elaser.png'))
    for k, col, light in (('ivan', P['red'], hx('ff9aa8')), ('hades', hx('4d8dff'), hx('b4cdff')), ('matias', P['green'], hx('a8ffc8'))):
        disparo(col, light).save(os.path.join(SP, 'shot_' + k + '.png'))
    for old in ('bafle', 'dron', 'chispa', 'apagon'):
        p = os.path.join(SP, old + '.png')
        if os.path.exists(p): os.remove(p)
    p = os.path.join(IMG, 'apagon_card.png')
    if os.path.exists(p): os.remove(p)
    # metadatos en art-data.js (se conservan los demás sprites)
    path = os.path.join(ROOT, 'js', 'data', 'art-data.js')
    src = open(path, encoding='utf-8').read()
    data = json.loads(re.search(r'window\.ART_DATA=(\{.*\});?\s*$', src, re.S).group(1))
    spr = data['sprites']
    for k in ('snowman', 'nutcracker', 'skull', 'elf', 'grinch', 'bafle', 'dron', 'chispa', 'apagon', 'noel'): spr.pop(k, None)
    spr.update({'patovica': {'w': 30, 'h': 34, 'n': 2}, 'regalo': {'w': 30, 'h': 44, 'n': 4}, 'esfera': {'w': 30, 'h': 28, 'n': 3},
                'duende': {'w': 24, 'h': 30, 'n': 3}})
    data['deco']['speaker'] = [32, 64]; data['deco']['console'] = [32, 32]
    data['lights'] = {'far_blink': fb, 'mid_bulbs': mb + xmas_bulbs, 'mid_neon': mn, 'near_consoles': nc}
    open(path, 'w', encoding='utf-8').write('// Metadatos del arte 8-bit (generado por tools/arte.py)\nwindow.ART_DATA=' + json.dumps(data, ensure_ascii=False) + ';\n')
    print('arte navideño generado')

if __name__ == '__main__':
    main()
