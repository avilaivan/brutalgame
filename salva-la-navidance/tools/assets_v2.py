# -*- coding: utf-8 -*-
"""Genera los sprites del juego desde arte-fuente/ASSETS AGREGADOS:
   - los 3 DJs (correr, disparar, correr disparando, salto, dash, muerte) -> assets/sprites/<dj>.png
   - ROBO-GRINCH (reposo, láser, pedir cohetes, cañón, pisotón, muerte)  -> assets/sprites/robogrinch.png
   - retratos y caras de los DJs, tarjeta del jefe, B-Coin nueva, cohete y plasma
   - metadatos -> js/data/sprites-data.js
   Uso (desde la carpeta salva-la-navidance):  python tools/assets_v2.py
"""
import os, sys, json
import numpy as np
import cv2
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hojas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '..', 'arte-fuente', 'ASSETS AGREGADOS')
OUT_S = os.path.join(ROOT, 'assets', 'sprites'); OUT_I = os.path.join(ROOT, 'assets', 'img')
DBG = os.environ.get('DBG')  # carpeta donde dejar hojas de revisión
S = lambda n: os.path.join(SRC, n)

HERO_H = 42          # alto del DJ parado, en píxeles del juego
CW, CH, AX, AY = 96, 64, 40, 62
BOSS_H = 124         # alto del Robo-Grinch parado

HEROES = {
    'ivan':   dict(trans='IVAN PERSONAJE TRANS.png', run='SECUENCIA PASOS CORRER IVAN.jpg', shoot='SECUENCIA DISPARO IVAN.jpg', jds='SECUENCIA SALTO DASH Y MUERTE IVAN.jpg', die_n=6, color=(255, 46, 74), dark=(92, 8, 21)),
    'hades':  dict(trans='BB HADES PERSONAJE TRANS.png', run='SECUENCIAS PASOS CORRER BB HADES.jpg', shoot='SECUENCIA DISPARO BB HADES.jpg', jds='SECUENCIA SALTO DASH Y MUERTE BB HADES.jpg', die_n=5, color=(77, 141, 255), dark=(11, 36, 99)),
    'matias': dict(trans='MATIAS PERSONAJE TRANS.png', run='SECUENCIAS PASOS CORRER MATIAS.jpg', shoot='SECUENCIA DISPARO MATIAS.jpg', jds='SECUENCIA SALTO DASH Y MUERTE MATIAS.jpg', die_n=6, color=(51, 224, 122), dark=(10, 74, 37)),
}


def load_trans(path):
    im = np.array(Image.open(path).convert('RGBA'))
    im[im[..., 3] < 128] = 0; im[..., 3] = np.where(im[..., 3] >= 128, 255, 0)
    t, _, _ = hojas.trim(im)
    return t


def anchor_x(im):
    """x de los pies: centro de masa de la parte baja del cuadro."""
    a = im[..., 3] > 0; h = a.shape[0]
    low = a[int(h * 0.62):]
    xs = np.where(low)[1]
    return float(xs.mean()) if len(xs) else a.shape[1] / 2


def body_anchor(fr):
    """Para cuadros con efectos pegados (fogonazo, polvo): se ancla con el cuerpo, no con el efecto."""
    bx, by, bw, bh = fr['body']; im = fr['im']
    sub = im[by:by + bh, bx:bx + bw]
    return bx + anchor_x(sub)


def place(cell_w, cell_h, ax, ay, im, axf):
    c = np.zeros((cell_h, cell_w, 4), np.uint8)
    h, w = im.shape[:2]
    x0 = int(round(ax - axf)); y0 = ay - h
    sx0, sy0 = max(0, -x0), max(0, -y0)
    x0, y0 = max(0, x0), max(0, y0)
    ww = min(w - sx0, cell_w - x0); hh = min(h - sy0, cell_h - y0)
    if ww > 0 and hh > 0: c[y0:y0 + hh, x0:x0 + ww] = im[sy0:sy0 + hh, sx0:sx0 + ww]
    return c


def scaled(fr, scale):
    im = fr['im'] if isinstance(fr, dict) else fr
    ax = body_anchor(fr) if isinstance(fr, dict) else anchor_x(im)
    # achicado en 2 pasos (primero a 2x y después a 1x): conserva mejor ojos, bordes del traje y piernas
    mid = hojas.downscale(im, scale * 2, sharpen=False)
    return hojas.downscale(mid, 0.5, amount=0.45), ax * scale


def clean_floor(pair):
    """Borra los restos de la línea de piso dibujada en la hoja (raya oscura y fina bajo los pies)."""
    im, ax = pair; im = im.copy(); a = im[..., 3] > 0; h, w = a.shape
    for y in range(h - 1, max(0, h - 5), -1):
        dark = a[y] & (im[y, :, :3].max(axis=1) < 70)
        above = a[y - 1] if y > 0 else np.zeros(w, bool)
        x = 0
        while x < w:
            if dark[x]:
                x1 = x
                while x1 < w and dark[x1]: x1 += 1
                # tramo oscuro largo con poco cuerpo encima = línea de piso
                if x1 - x >= 4 and above[x:x1].mean() < 0.5: im[y, x:x1] = 0
                x = x1
            else: x += 1
    return im, ax


def rows_ok(rows, n=3):
    return [r for r in rows if len(r) >= n]


def build_hero(key, H):
    anims = {}
    # ---- reposo: el arte "PERSONAJE TRANS" ----
    t = load_trans(S(H['trans']))
    anims['idle'] = [scaled(t, HERO_H / t.shape[0])]
    # ---- correr ----
    rows = rows_ok(hojas.extract(S(H['run']), holes=150))
    run = [hojas.cut_floor_line(f) for r in rows for f in r]
    ref = np.median([f['body'][3] for f in run])
    # en las hojas de correr todos los cuadros están agachados: se usa la misma escala que el arte parado
    sc = HERO_H / (ref / 0.93)
    anims['run'] = [clean_floor(scaled(f, sc)) for f in run]
    # ---- disparo parado / corriendo (el proyectil suelto no se pega: lo dibuja el juego) ----
    rows = rows_ok(hojas.extract(S(H['shoot']), attach=14, holes=150, front=True))
    sc = HERO_H / rows[0][0]['body'][3]
    anims['shoot'] = [scaled(f, sc) for f in rows[0]]
    anims['runshoot'] = [clean_floor(scaled(f, sc)) for f in rows[1]]
    # ---- salto, dash y muerte ----
    rows = rows_ok(hojas.extract(S(H['jds']), min_h=0.07, attach=18, holes=40))
    sc = HERO_H / rows[0][0]['body'][3]
    anims['jump'] = [scaled(f, sc) for f in rows[0]]
    anims['dash'] = [scaled(f, sc) for f in rows[1]]
    anims['die'] = [scaled(f, sc) for f in rows[2][:H['die_n']]]
    anims['hurt'] = anims['die'][:2]
    # ---- paleta común y hoja ----
    names = ['idle', 'run', 'shoot', 'runshoot', 'jump', 'dash', 'hurt', 'die']
    flat = [f for n in names for f, _ in anims[n]]
    q = [hojas.outline(f) for f in hojas.quantize(flat, 96)]; it = iter(q)
    cols = max(len(anims[n]) for n in names)
    sheet = np.zeros((CH * len(names), CW * cols, 4), np.uint8)
    meta = {}
    for r, n in enumerate(names):
        meta[n] = {'row': r, 'n': len(anims[n])}
        for c, (_, ax) in enumerate(anims[n]):
            sheet[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = place(CW, CH, AX, AY, next(it), ax)
    Image.fromarray(sheet).save(os.path.join(OUT_S, key + '.png'), optimize=True)
    # ---- retrato (360x360) y cara (96x96) ----
    big = Image.fromarray(t)
    for name, size, crop in (('portrait', 360, None), ('face', 96, 'head')):
        bg = Image.new('RGB', (size, size)); d = ImageDraw.Draw(bg)
        for y in range(size):
            k = y / size; d.line([(0, y), (size, y)], fill=tuple(int(H['dark'][i] * (0.35 + 0.9 * k) + 8) for i in range(3)))
        # franjas diagonales de neón (estilo tarjeta arcade)
        for i in range(-size, size, size // 6):
            d.polygon([(i, size), (i + size // 14, size), (i + size + size // 14, 0), (i + size, 0)], fill=tuple(min(255, int(H['dark'][j] * 1.5 + 14)) for j in range(3)))
        if crop == 'head':
            hh = int(big.height * 0.46); src = big.crop((int(big.width * 0.18), 0, int(big.width * 0.18) + hh, hh))
            src = src.resize((size, size), Image.NEAREST); bg.paste(src, (0, 0), src)
        else:
            k = (size * 0.94) / max(big.width, big.height)
            src = big.resize((int(big.width * k), int(big.height * k)), Image.NEAREST)
            bg.paste(src, ((size - src.width) // 2, size - src.height - 4), src)
        bg.save(os.path.join(OUT_I, '%s_%s.jpg' % (key, name)), quality=90)
    return meta, anims


# ------------------------------------------------------------------ ROBO-GRINCH
def build_boss():
    def flip(fr):
        fr = dict(fr); fr['im'] = fr['im'][:, ::-1].copy(); return fr
    t = load_trans(S('ROBO-GRINCH BOSS FINAL.png'))
    las = hojas.extract_grid(S('ANIMACION ROBOGRINCH LASER DISPARO Y PEDIR COHETES QUE CAIGAN DEL CIELO.jpg'), 6, 2)
    act = hojas.extract_grid(S('ANMACION ROBO GRINCH DISPARO Y PISOTON PARA ONDA DE AUDIO.jpg'), 6, 2, ybounds=[110, 760, 1536])
    die = hojas.extract_grid(S('ANIMACION MUERTE ROBO-GRINCH.jpg'), 4, 2, corner=0.16)
    s_las = BOSS_H / las[0][0]['im'].shape[0]
    s_act = BOSS_H / act[0][0]['im'].shape[0]
    s_die = BOSS_H / die[0][0]['im'].shape[0] * 1.02
    # ---- cuadros de cada animación, a la resolución original de la hoja ----
    SEQ = []  # (nombre, [(imagen RGBA original, escala), ...])
    def src(fr, sc, fl=False):
        im = fr['im'] if isinstance(fr, dict) else fr
        return (im[:, ::-1].copy() if fl else im, sc)
    SEQ.append(('idle', [src(t, BOSS_H / t.shape[0]), src(las[0][0], s_las)]))
    SEQ.append(('laser', [src(las[0][i], s_las, True) for i in range(1, 6)]))          # carga los lentes y dispara
    SEQ.append(('rocket', [src(las[1][1], s_las), src(las[1][2], s_las), src(las[1][3], s_las, True), src(las[1][4], s_las, True)]))  # se acomoda los lentes, señala el cielo
    SEQ.append(('cannon', [src(act[0][i], s_act, True) for i in range(6)]))             # el brazo se vuelve cañón y dispara
    SEQ.append(('stomp', [src(act[1][i], s_act, True) for i in range(6)]))              # levanta la pierna y pisa
    SEQ.append(('die', [src(die[i // 4][i % 4], s_die) for i in range(5)]))            # chispazos, se arrodilla, explota (después estalla en partículas)
    TWEEN = {'laser', 'rocket', 'cannon', 'stomp', 'die'}
    # ---- cuadros intermedios generados (flujo óptico) entre cada par: la animación pasa a tener el doble de cuadros ----
    F = []  # (nombre, imagen achicada)
    BAD = []  # intermedios descartados (movimiento demasiado grande): ahí el juego hace una transición suave
    TWEEN_MAX = float(os.environ.get('TWEEN_MAX', 0.16))
    for name, fr in SEQ:
        for i, (im, sc) in enumerate(fr):
            F.append((name, hojas.downscale(im, sc)))
            if name in TWEEN and i + 1 < len(fr):
                im2, sc2 = fr[i + 1]
                if abs(sc - sc2) > 1e-6: im2 = cv2.resize(im2, (int(im2.shape[1] * sc / sc2), int(im2.shape[0] * sc / sc2)), interpolation=cv2.INTER_AREA)
                mid, _ = hojas.tween(im, im2, anchor_x(im), anchor_x(im2))
                print('   intermedio', name, i, 'error %.3f' % hojas.tween.err)
                if hojas.tween.err > TWEEN_MAX: BAD.append(len(F))
                F.append((name + '~', hojas.downscale(mid, sc)))
    q = hojas.quantize([f[1] for f in F], 112)
    frames = [(name, im, anchor_x(im)) for (name, _), im in zip(F, q)]
    left = max(ax for _, _, ax in frames); right = max(im.shape[1] - ax for _, im, ax in frames)
    bw = int(np.ceil(max(left, right))) * 2 + 4; bh = max(im.shape[0] for _, im, _ in frames) + 2
    bw += bw % 2
    cols = 10; nrows = int(np.ceil(len(frames) / cols))
    sheet = np.zeros((bh * nrows, bw * cols, 4), np.uint8)
    anims = {}
    for i, (name, im, ax) in enumerate(frames):
        anims.setdefault(name.rstrip('~'), []).append(i)
        r, c = divmod(i, cols)
        sheet[r * bh:(r + 1) * bh, c * bw:(c + 1) * bw] = place(bw, bh, bw // 2, bh, im, ax)
    Image.fromarray(sheet).save(os.path.join(OUT_S, 'robogrinch.png'), optimize=True)
    # ---- bloques para que estalle en partículas (cuadro de la explosión: último de 'die') ----
    BL = 5; ex = anims['die'][-1]; r, c = divmod(ex, cols)
    cell = sheet[r * bh:(r + 1) * bh, c * bw:(c + 1) * bw, 3] > 0
    blocks = [[x, y] for y in range(0, bh, BL) for x in range(0, bw, BL) if cell[y:y + BL, x:x + BL].sum() >= 6]
    # tarjeta para la presentación VS
    big = Image.fromarray(t); size = 400
    card = Image.new('RGB', (size, size), (30, 6, 12)); d = ImageDraw.Draw(card)
    for i in range(-size, size, 66): d.polygon([(i, size), (i + 30, size), (i + size + 30, 0), (i + size, 0)], fill=(58, 10, 18))
    k = size * 0.96 / max(big.size); src = big.resize((int(big.width * k), int(big.height * k)), Image.NEAREST)
    card.paste(src, ((size - src.width) // 2, size - src.height), src)
    card.save(os.path.join(OUT_I, 'robogrinch_card.png'))
    # anims[nombre] = [primer cuadro, cuadros ORIGINALES, intercalado]. Si está intercalado, el cuadro original i
    # está en primero + 2*i y el intermedio generado entre i e i+1 en primero + 2*i + 1.
    meta = {'w': bw, 'h': bh, 'cols': cols, 'n': len(frames),
            'anims': {k: [v[0], (len(v) + 1) // 2 if k in TWEEN else len(v), 1 if k in TWEEN else 0] for k, v in anims.items()},
            'bad': BAD, 'shatter': {'f': ex, 'b': BL, 'cells': blocks}}
    return meta, sheet


# ------------------------------------------------------------------ B-COIN
def build_coin():
    rgb = hojas.load(S('BRUTAL COINT.jpg'))
    fg, _ = hojas.fg_mask(rgb, 40)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)); fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k)
    im = np.dstack([rgb, fg * 255]); im, _, _ = hojas.trim(im)
    big = Image.fromarray(im)
    big.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT_I, 'coin.png'))
    def spin(size, widths):
        base = hojas.downscale(im, size / im.shape[0])
        b = Image.fromarray(base).resize((size, size), Image.NEAREST)
        sh = Image.new('RGBA', (size * len(widths), size))
        for i, w in enumerate(widths):
            f = b.resize((max(2, w), size), Image.NEAREST) if w != size else b
            if w <= size // 4:  # de canto: solo el borde dorado
                f = Image.new('RGBA', (max(2, w), size)); dd = ImageDraw.Draw(f)
                dd.rectangle([0, 1, max(2, w) - 1, size - 2], fill=(214, 150, 20, 255)); dd.rectangle([0, 2, 0, size - 3], fill=(255, 220, 90, 255))
            sh.paste(f, (i * size + (size - f.width) // 2, 0), f)
        return sh
    spin(16, [16, 12, 6, 2, 6, 12]).save(os.path.join(OUT_S, 'coin.png'))
    spin(26, [26, 20, 8, 20]).save(os.path.join(OUT_S, 'mega.png'))
    return {'coin': {'w': 16, 'h': 16, 'n': 6}, 'mega': {'w': 26, 'h': 26, 'n': 4}}


# ------------------------------------------------------------------ FAVICON / ÍCONOS (B-COIN en 8-bit)
def build_icons():
    rgb = hojas.load(S('BRUTAL COINT.jpg'))
    fg, _ = hojas.fg_mask(rgb, 40)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)); fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8); big = 1 + int(np.argmax(st[1:, 4]))
    # recorte circular limpio: el círculo que mejor encierra la moneda
    ys, xs = np.where(lab == big); cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2; r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2
    yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]]
    disc = ((xx - cx) ** 2 + (yy - cy) ** 2) <= (r - 1) ** 2
    im = np.dstack([rgb, disc.astype(np.uint8) * 255])[int(cy - r):int(cy + r) + 1, int(cx - r):int(cx + r) + 1]
    def pixel(size, colors):
        a = hojas.downscale(im, size / im.shape[0], amount=0.5)
        sq = np.zeros((size, size, 4), np.uint8); h, w = a.shape[:2]; oy, ox = (size - h) // 2, (size - w) // 2
        sq[oy:oy + h, ox:ox + w] = a[:size - oy, :size - ox]
        return hojas.outline(hojas.quantize([sq], colors)[0], 0.3)
    p32 = pixel(32, 24); p16 = pixel(16, 16); p48 = pixel(48, 32)
    Image.fromarray(p32).save(os.path.join(OUT_I, 'favicon.png'))
    Image.fromarray(p16).save(os.path.join(OUT_I, 'favicon-16.png'))
    Image.fromarray(p48).save(os.path.join(OUT_I, 'favicon-48.png'))
    Image.fromarray(p48).save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    # íconos grandes (celular / acceso directo): la B-Coin pixelada a 64 px y agrandada sin suavizar, sobre fondo oscuro
    p64 = Image.fromarray(pixel(64, 40))
    for name, size, pad in (('apple-touch-icon.png', 180, 14), ('icon-192.png', 192, 14), ('icon-512.png', 512, 36)):
        bg = Image.new('RGBA', (size, size), (7, 6, 11, 255)); inner = size - pad * 2
        bg.alpha_composite(p64.resize((inner, inner), Image.NEAREST), (pad, pad))
        bg.convert('RGB').save(os.path.join(OUT_I, name))
    return {}


# ------------------------------------------------------------------ COHETE Y PLASMA (dibujados a mano)
def build_fx():
    P = {'k': (11, 10, 18, 255), 'w': (244, 248, 255, 255), 'g': (142, 162, 196, 255), 'r': (255, 46, 74, 255), 'R': (140, 16, 34, 255),
         'G': (51, 224, 122, 255), 'y': (255, 210, 61, 255), 'o': (255, 138, 61, 255), '.': (0, 0, 0, 0)}
    rocket = [  # apunta hacia abajo; 2 cuadros (la llama cambia)
        ['....yy....', '...yooy...', '...yooy...', '....oo....', '..kkkkkk..', '.kRrrrrRk.', '.krrwwrrk.', '.krrwwrrk.', '.kGGGGGGk.', '.kwwwwwwk.', '.kwwggwwk.', '.kwwggwwk.', '.kwwwwwwk.', '.kGGGGGGk.', '.krrrrrrk.', '..krrrrk..', '..kRrrRk..', '...krrk...', '...kRRk...', '....kk....'],
        ['.....y....', '....yy....', '...yoyy...', '...yoo....', '..kkkkkk..', '.kRrrrrRk.', '.krrwwrrk.', '.krrwwrrk.', '.kGGGGGGk.', '.kwwwwwwk.', '.kwwggwwk.', '.kwwggwwk.', '.kwwwwwwk.', '.kGGGGGGk.', '.krrrrrrk.', '..krrrrk..', '..kRrrRk..', '...krrk...', '...kRRk...', '....kk....'],
    ]
    w, h = 10, 20
    im = Image.new('RGBA', (w * 2, h))
    for f, rows in enumerate(rocket):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row): im.putpixel((f * w + x, y), P[ch])
    im.save(os.path.join(OUT_S, 'rocket.png'))
    # plasma del cañón: bola naranja con núcleo blanco, 2 cuadros
    pl = Image.new('RGBA', (28, 14)); d = ImageDraw.Draw(pl)
    for f in range(2):
        ox = f * 14
        d.ellipse([ox + 1, 1, ox + 12, 12], fill=(11, 10, 18, 255)); d.ellipse([ox + 2, 2, ox + 11, 11], fill=(255, 138, 61, 255))
        d.ellipse([ox + 3 + f, 3, ox + 9 + f, 9], fill=(255, 210, 61, 255)); d.ellipse([ox + 5, 5 - f, ox + 8, 8 - f], fill=(255, 255, 255, 255))
    pl.save(os.path.join(OUT_S, 'plasma.png'))
    return {'rocket': {'w': 10, 'h': 20, 'n': 2}, 'plasma': {'w': 14, 'h': 14, 'n': 2}}


# ------------------------------------------------------------------ PARLANTES ROBADOS (la bolsa detrás del jefe)
def build_bag():
    rgb = hojas.load(S('PARLANTES ROBADOS.jpg'))
    fg, _ = hojas.fg_mask(rgb, 22, holes=400)
    # la sombra del piso (elipse gris bajo la bolsa) se va: el juego dibuja la suya
    a = rgb.astype(int); grey = (np.abs(a[..., 0] - a[..., 1]) < 14) & (np.abs(a[..., 1] - a[..., 2]) < 14) & (a[..., 0] > 60)
    H = rgb.shape[0]; fg[int(H * 0.86):][grey[int(H * 0.86):]] = 0
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)); fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8); big = 1 + int(np.argmax(st[1:, 4])); keep = np.zeros_like(fg)
    for i in range(1, n):
        if st[i][4] > 300: keep[lab == i] = 1
    im = np.dstack([rgb, keep * 255]); im, _, _ = hojas.trim(im)
    out = {}
    for name, hh in (('bag', 66), ('bag_big', 120)):
        sm = hojas.downscale(im, hh / im.shape[0]); sm = hojas.quantize([sm], 64)[0]
        Image.fromarray(sm).save(os.path.join(OUT_S if name == 'bag' else OUT_I, name + '.png'), optimize=True)
        out[name] = {'w': int(sm.shape[1]), 'h': int(sm.shape[0]), 'n': 1}
    return out


def main():
    data = {'cw': CW, 'ch': CH, 'ax': AX, 'ay': AY, 'anims': {}}
    dbg = []
    for k, H in HEROES.items():
        meta, anims = build_hero(k, H); data['anims'][k] = meta
        print(k, {n: m['n'] for n, m in meta.items()})
    boss, _ = build_boss(); print('robogrinch', boss)
    extra = {}; extra.update(build_coin()); extra.update(build_fx()); extra.update(build_bag()); build_icons()
    with open(os.path.join(ROOT, 'js', 'data', 'sprites-data.js'), 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/assets_v2.py desde arte-fuente/ASSETS AGREGADOS (no editar a mano)\n')
        f.write('window.SPRITE_DATA = ' + json.dumps(data) + ';\n')
        f.write('window.BOSS_DATA = ' + json.dumps(boss) + ';\n')
        f.write('window.SPRITE_EXTRA = ' + json.dumps(extra) + ';\n')


if __name__ == '__main__':
    main()
