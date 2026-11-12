# =====================================================================
#  GENERADOR DE ARTE 8-BIT — Salva la Navidance · BRUTAL. (9 de Julio)
#  Dibuja píxel por píxel (sin IA) el fondo de la ciudad de 9 de Julio,
#  los tiles, los enemigos y el jefe EL APAGÓN, y escribe sus metadatos
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
    # luna llena con cráteres y halo
    mx, my, r = 520, 62, 20
    for y in range(-r - 8, r + 9):
        for x in range(-r - 8, r + 9):
            dd = math.hypot(x, y)
            if dd <= r:
                c = P['stone3'] if (x * 0.6 - y * 0.8) < r * 0.35 else P['stone2']
                im.putpixel((mx + x, my + y), c)
            elif dd <= r + 8 and (x + y) % 2 == 0 and dd <= r + 4 + (x % 3):
                im.putpixel((mx + x, my + y), lerp(P['night1'], P['stone1'], 0.35))
    for cx, cy, cr in ((-6, -5, 4), (5, 3, 3), (-2, 8, 2), (8, -7, 2)):
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
def sheet(frames):
    w, h = frames[0].size; s = new(w * len(frames), h)
    for i, f in enumerate(frames): s.alpha_composite(f, (i * w, 0))
    return s

def patovica(f):
    """Patovica de BRUTAL.: pelado, anteojos negros, cucaracha en la oreja, remera negra con la B. — salta al beat."""
    im = new(30, 34); d = ImageDraw.Draw(im); oy = 1 if f else 0
    # piernas
    R(d, 9, 26, 5, 8, P['denim']); R(d, 16, 26, 5, 8, P['denim']); R(d, 9, 26, 1, 8, P['denim2']); R(d, 16, 26, 1, 8, P['denim2'])
    R(d, 8, 32, 7, 2, P['black']); R(d, 15, 32, 7, 2, P['black'])
    # torso ancho
    R(d, 4, 12 + oy, 22, 15 - oy, P['black']); R(d, 4, 12 + oy, 22, 1, P['grey1']); R(d, 4, 12 + oy, 2, 15, P['grey0'])
    R(d, 13, 18 + oy, 4, 5, P['red'])  # B. en el pecho
    R(d, 14, 19 + oy, 2, 1, P['white']); R(d, 14, 21 + oy, 2, 1, P['white'])
    if f == 0:  # brazos cruzados
        R(d, 5, 19, 20, 4, P['skin1']); R(d, 5, 19, 20, 1, P['skin2']); R(d, 5, 22, 20, 1, P['skin0'])
    else:       # puños arriba
        R(d, 1, 8, 4, 10, P['skin1']); R(d, 25, 8, 4, 10, P['skin1']); R(d, 0, 6, 6, 4, P['skin2']); R(d, 24, 6, 6, 4, P['skin2'])
    # cabeza pelada
    R(d, 10, 2 + oy, 10, 11, P['skin1']); R(d, 10, 2 + oy, 10, 2, P['skin2']); R(d, 18, 4 + oy, 2, 9, P['skin0'])
    R(d, 9, 6 + oy, 12, 3, INK); R(d, 10, 6 + oy, 4, 1, P['cyan']); R(d, 16, 6 + oy, 4, 1, P['cyan'])  # anteojos
    R(d, 12, 11 + oy, 6, 1, P['skin0'])  # boca seria
    R(d, 20, 7 + oy, 1, 6, P['grey3']); R(d, 20, 13 + oy, 2, 1, P['grey3'])  # cucaracha
    return outline(im)

def bafle(f):
    """Bafle poseído: caja de sonido con patas, LEDs enojados y una bocina que dispara notas."""
    im = new(30, 44); d = ImageDraw.Draw(im)
    pump = 1 if f in (1, 3) else 0
    R(d, 9, 39, 3, 5, P['grey2']); R(d, 18, 39, 3, 5, P['grey2']); R(d, 7, 42, 6, 2, P['black']); R(d, 17, 42, 6, 2, P['black'])
    R(d, 5, 3, 20, 37, P['black']); R(d, 5, 3, 20, 1, P['grey2']); R(d, 5, 3, 1, 37, P['grey1']); R(d, 24, 3, 1, 37, P['grey0'])
    for cx, cy in ((5, 3), (22, 3), (5, 37), (22, 37)): R(d, cx, cy, 3, 3, P['grey3'])
    eye = P['red'] if f == 2 else P['amber']
    R(d, 9, 7, 4, 2, eye); R(d, 17, 7, 4, 2, eye); px(im, 9, 6, eye); px(im, 20, 6, eye)  # cejas en V
    if f == 2: R(d, 8, 6, 14, 1, P['red2'])
    d.ellipse([10, 11, 19, 20], fill=P['grey1']); d.ellipse([12, 13, 17, 18], fill=P['grey0']); R(d, 14, 15, 2, 2, P['grey3'])
    r = 7 + pump
    d.ellipse([15 - r, 30 - r, 14 + r, 29 + r], fill=P['grey1']); d.ellipse([15 - r + 2, 30 - r + 2, 14 + r - 2, 29 + r - 2], fill=P['grey0'])
    d.ellipse([12, 27, 17, 32], fill=P['steel1']); R(d, 14, 28, 2, 2, P['steel3'])
    # bocina lateral (apunta a la derecha; el código la espeja)
    R(d, 25, 19, 3, 6, P['grey2']); R(d, 27, 17, 2, 10, P['grey3'])
    if f == 3:
        R(d, 29, 20, 1, 4, P['pink']); px(im, 29, 18, P['white']); px(im, 29, 25, P['white'])
    if f == 2: R(d, 27, 21, 2, 2, P['pink'])
    return outline(im)

def dron(f):
    """Dron de control del Apagón: cuerpo con cámara roja, hélices que giran y sirena."""
    im = new(30, 28); d = ImageDraw.Draw(im)
    R(d, 4, 9, 22, 2, P['grey2'])  # brazos
    for hx_ in (3, 23):
        R(d, hx_ + 1, 6, 2, 4, P['grey1'])
        blade = [(hx_ - 4, 5, 12, 1), (hx_ - 1, 4, 6, 3), (hx_ - 3, 5, 10, 1)][f]
        R(d, blade[0], blade[1], blade[2], blade[3], P['grey4'])
    R(d, 9, 10, 12, 10, P['steel1']); R(d, 9, 10, 12, 2, P['steel3']); R(d, 9, 18, 12, 2, P['steel0'])
    d.ellipse([11, 12, 18, 19], fill=INK); d.ellipse([13, 14, 16, 17], fill=P['red']); px(im, 14, 14, P['white'])
    R(d, 13, 8, 4, 2, P['red'] if f != 1 else P['cyan'])  # sirena
    R(d, 12, 20, 6, 3, P['grey1']); R(d, 13, 23, 4, 2, P['yellow'])  # reflector
    return outline(im)

def chispa(f):
    """Chispa: electricista malvado con casco amarillo y visor rojo que tira fusibles."""
    im = new(24, 30); d = ImageDraw.Draw(im)
    jump = f == 2
    if jump: R(d, 7, 22, 4, 4, P['denim']); R(d, 13, 22, 4, 4, P['denim'])
    else: R(d, 7, 23, 4, 6, P['denim']); R(d, 13, 23, 4, 6, P['denim']); R(d, 6, 28, 6, 2, P['black']); R(d, 12, 28, 6, 2, P['black'])
    R(d, 6, 13, 12, 11, P['denim2']); R(d, 6, 13, 12, 1, P['steel2'])
    d.polygon([(12, 15), (10, 19), (12, 19), (11, 22), (14, 17), (12, 17), (13, 15)], fill=P['yellow'])  # rayo
    R(d, 7, 5, 10, 9, P['skin1']); R(d, 7, 9, 10, 3, INK); R(d, 8, 10, 3, 1, P['red']); R(d, 13, 10, 3, 1, P['red'])  # visor
    R(d, 5, 3, 14, 3, P['yellow']); R(d, 7, 1, 10, 3, P['yellow']); R(d, 7, 1, 10, 1, (255, 240, 160, 255)); R(d, 5, 5, 14, 1, P['yellow2'])
    R(d, 9, 12, 6, 1, P['skin0'])
    if f == 1:  # brazo arriba con fusible
        R(d, 17, 4, 3, 10, P['denim2']); R(d, 17, 0, 4, 5, P['red']); px(im, 18, 0, P['white'])
    else:
        R(d, 3, 14, 3, 7, P['denim2']); R(d, 18, 14, 3, 7, P['denim2']); R(d, 18, 20, 4, 4, P['red'])
    return outline(im)

def fusible(f):
    """bomba de fusible (rojo / verde) con chispa"""
    im = new(10, 11); d = ImageDraw.Draw(im)
    col = P['red'] if f < 2 else P['green']; dark = P['red2'] if f < 2 else P['green2']
    R(d, 3, 1, 4, 2, P['grey3']); d.ellipse([1, 3, 8, 10], fill=col); d.ellipse([2, 4, 4, 6], fill=P['white']); R(d, 6, 8, 2, 2, dark)
    sp = (4, 0) if f % 2 == 0 else (6, 0)
    px(im, sp[0], sp[1], P['yellow']); px(im, sp[0] + 1, sp[1], P['white'])
    return im

def onda(f):
    """onda eléctrica del pisotón del jefe"""
    im = new(20, 16); d = ImageDraw.Draw(im)
    pts = [(0, 15), (3, 8 + f * 2), (6, 13), (9, 3), (12, 12 - f), (15, 6), (19, 15)]
    d.line(pts, fill=P['cyan'], width=3); d.line(pts, fill=P['white'], width=1)
    return im

def nota():
    im = new(12, 4); d = ImageDraw.Draw(im)
    R(d, 0, 0, 12, 4, P['pink']); R(d, 2, 1, 9, 2, P['white']); return im

# ======================================================================
#  JEFE: EL APAGÓN (150x132, 6 cuadros)
#   0-1 quieto · 2 apunta · 3 dispara · 4 pisotón · 5 vencido
# ======================================================================
LENS_L, LENS_R, CORE = (52, 36), (76, 36), (72, 82)
def apagon(f):
    im = new(150, 132); d = ImageDraw.Draw(im)
    oy = 2 if f == 1 else 0
    dead = f == 5
    # piernas: torres de alta tensión cortas
    for lx in (40, 92):
        d.polygon([(lx, 132), (lx + 6, 104), (lx + 18, 104), (lx + 24, 132)], fill=P['steel0'])
        d.line([(lx + 3, 130), (lx + 18, 106)], fill=P['steel2']); d.line([(lx + 21, 130), (lx + 6, 106)], fill=P['steel2'])
        R(d, lx - 2, 128, 28, 4, P['grey1'])
    # cuerpo: transformador con aletas de refrigeración
    bx, by, bw, bh = 34, 56 + oy, 84, 52
    for k in range(6): R(d, bx - 8, by + 6 + k * 7, 8, 4, P['steel1']); R(d, bx + bw, by + 6 + k * 7, 8, 4, P['steel1'])
    R(d, bx, by, bw, bh, P['steel1']); R(d, bx, by, bw, 3, P['steel3']); R(d, bx, by, 3, bh, P['steel2']); R(d, bx + bw - 3, by, 3, bh, P['steel0'])
    R(d, bx, by + bh - 4, bw, 4, P['steel0'])
    for k in range(bx + 6, bx + bw - 6, 6): R(d, k, by + 6, 1, 10, P['steel0'])  # remaches/rejillas
    # cartel de peligro
    d.polygon([(bx + 10, by + 40), (bx + 19, by + 24), (bx + 28, by + 40)], fill=P['yellow']); d.polygon([(bx + 13, by + 38), (bx + 19, by + 28), (bx + 25, by + 38)], fill=INK)
    d.polygon([(bx + 19, by + 29), (bx + 17, by + 34), (bx + 19, by + 34), (bx + 18, by + 37), (bx + 21, by + 32), (bx + 19, by + 32)], fill=P['yellow'])
    # núcleo: palanca de corte (brilla en el descanso)
    cx, cy = CORE[0], CORE[1] + oy
    R(d, cx - 12, cy - 12, 24, 24, INK); R(d, cx - 10, cy - 10, 20, 20, P['grey1'])
    lev = (cx - 2, cy - 9) if not dead else (cx - 2, cy + 1)
    R(d, lev[0], lev[1], 4, 8, P['red']); R(d, cx - 5, cy - 1, 10, 3, P['grey3'])
    R(d, cx - 9, cy - 9, 3, 2, P['green'] if not dead else P['grey2']); R(d, cx + 6, cy + 6, 3, 2, P['red2'])
    # brazos de cable con pinzas
    arm_up = f == 4
    for side, ax in ((-1, bx - 8), (1, bx + bw + 8)):
        sx = ax; sy = by + 10
        ex = sx + side * 18; ey = (sy - 50) if (arm_up and side == 1) else (sy + 34)
        d.line([(sx, sy), (ex, ey)], fill=INK, width=7); d.line([(sx, sy), (ex, ey)], fill=P['black'], width=5)
        d.line([(sx, sy), (ex, ey)], fill=P['grey1'], width=1)
        # pinza (morsa de batería)
        jc = P['red'] if side == -1 else P['grey0']
        R(d, ex - 7, ey - 4, 14, 8, jc); R(d, ex - 7, ey - 4, 14, 2, P['red'] if side == -1 else P['grey2'])
        for k in range(-6, 7, 3): px(im, ex + k, ey + 4, P['steel3'])
    # cabeza: caja de medidor con dos lentes
    hx0, hy0 = 40, 18 + oy
    R(d, hx0, hy0, 72, 40, P['steel1']); R(d, hx0, hy0, 72, 3, P['steel3']); R(d, hx0, hy0, 3, 40, P['steel2']); R(d, hx0 + 69, hy0, 3, 40, P['steel0'])
    # aisladores de porcelana con chispa en la cabeza
    for ix in (hx0 + 8, hx0 + 32, hx0 + 56):
        for k in range(4): R(d, ix - 3 + (k % 2), hy0 - 4 - k * 4, 8 - 2 * (k % 2), 3, P['stone3'] if k % 2 == 0 else P['stone2'])
    if not dead and f in (2, 3):
        d.line([(hx0 + 11, hy0 - 20), (hx0 + 22, hy0 - 26), (hx0 + 35, hy0 - 20)], fill=P['cyan'])
    for i, (lx, ly) in enumerate((LENS_L, LENS_R)):
        ly2 = ly + oy
        d.ellipse([lx - 9, ly2 - 9, lx + 9, ly2 + 9], fill=INK); d.ellipse([lx - 7, ly2 - 7, lx + 7, ly2 + 7], fill=P['grey1'])
        if dead:
            d.line([(lx - 4, ly2 - 4), (lx + 4, ly2 + 4)], fill=P['grey3'], width=2); d.line([(lx + 4, ly2 - 4), (lx - 4, ly2 + 4)], fill=P['grey3'], width=2)
            continue
        col = P['red'] if i == 0 else P['green']
        rr = 5 if f in (2, 3) else 4
        if f == 3: col = P['white']
        d.ellipse([lx - rr, ly2 - rr, lx + rr, ly2 + rr], fill=col)
        if f == 2: d.ellipse([lx - 7, ly2 - 7, lx + 7, ly2 + 7], outline=P['white'])
        px(im, lx - 2, ly2 - 2, P['white'])
    # boca: rejilla de medidor
    my_ = hy0 + 30
    if f == 3 or f == 4: R(d, 58, my_ - 1, 36, 7, INK); R(d, 60, my_ + 1, 32, 3, P['amber'])
    else:
        R(d, 58, my_, 36, 5, INK)
        for k in range(60, 92, 4): R(d, k, my_ + 1, 2, 3, P['grey2'] if not dead else P['grey1'])
    # display "OFF" en la frente
    R(d, 64, hy0 + 6, 24, 9, INK)
    for gx, gy in ((66, 8), (67, 8), (68, 8), (66, 9), (68, 9), (66, 10), (67, 10), (68, 10), (71, 8), (72, 8), (73, 8), (71, 9), (72, 9), (71, 10), (76, 8), (77, 8), (78, 8), (76, 9), (77, 9), (76, 10)):
        px(im, gx, hy0 + gy - 2 + 3, P['red'] if not dead else P['red3'])
    if dead:  # humo
        for k in range(6): d.ellipse([60 + k * 6, 4 + (k % 2) * 4, 70 + k * 6, 14 + (k % 2) * 4], fill=P['grey1'])
    return outline(im)

def apagon_card():
    """retrato del jefe para la presentación VS (reemplaza al personaje con derechos de autor)"""
    W, H = 404, 390; im = Image.new('RGBA', (W, H), P['night0']); d = ImageDraw.Draw(im)
    for y in range(H): R(d, 0, y, W, 1, lerp(P['night0'], P['red3'], y / H * 0.9))
    for k in range(0, W, 24): d.line([(k, H), (W // 2, H // 2)], fill=lerp(P['night1'], P['red3'], 0.5))
    boss = apagon(3).resize((150 * 3, 132 * 3), Image.NEAREST)
    im.alpha_composite(boss, (W // 2 - boss.width // 2 + 10, H - boss.height + 20))
    im.convert('RGB').save(os.path.join(IMG, 'apagon_card.png'))

# ======================================================================
def main():
    os.makedirs(BG, exist_ok=True)
    sky(); fb = far(); mb, mn = mid(); nc = near(); tiles(); deco_neumaticos()
    sheet([patovica(0), patovica(1)]).save(os.path.join(SP, 'patovica.png'))
    sheet([bafle(i) for i in range(4)]).save(os.path.join(SP, 'bafle.png'))
    sheet([dron(i) for i in range(3)]).save(os.path.join(SP, 'dron.png'))
    sheet([chispa(i) for i in range(3)]).save(os.path.join(SP, 'chispa.png'))
    sheet([apagon(i) for i in range(6)]).save(os.path.join(SP, 'apagon.png'))
    sheet([fusible(i) for i in range(4)]).save(os.path.join(SP, 'ornament.png'))
    sheet([onda(i) for i in range(2)]).save(os.path.join(SP, 'wave.png'))
    nota().save(os.path.join(SP, 'elaser.png'))
    apagon_card()
    # metadatos en art-data.js (se conservan los demás sprites)
    path = os.path.join(ROOT, 'js', 'data', 'art-data.js')
    src = open(path, encoding='utf-8').read()
    data = json.loads(re.search(r'window\.ART_DATA=(\{.*\});?\s*$', src, re.S).group(1))
    spr = data['sprites']
    for k in ('snowman', 'nutcracker', 'skull', 'elf', 'grinch'): spr.pop(k, None)
    spr.update({'patovica': {'w': 30, 'h': 34, 'n': 2}, 'bafle': {'w': 30, 'h': 44, 'n': 4}, 'dron': {'w': 30, 'h': 28, 'n': 3},
                'chispa': {'w': 24, 'h': 30, 'n': 3}, 'apagon': {'w': 150, 'h': 132, 'n': 6, 'lensL': list(LENS_L), 'lensR': list(LENS_R), 'core': list(CORE)}})
    data['lights'] = {'far_blink': fb, 'mid_bulbs': mb, 'mid_neon': mn, 'near_consoles': nc}
    open(path, 'w', encoding='utf-8').write('// Metadatos del arte 8-bit (generado por tools/arte.py)\nwindow.ART_DATA=' + json.dumps(data, ensure_ascii=False) + ';\n')
    print('arte generado')

if __name__ == '__main__':
    main()
