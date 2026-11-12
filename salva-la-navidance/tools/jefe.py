# =====================================================================
#  JEFE FINAL: DON GRUÑÓN
#  Convierte la hoja de cuadros (arte-fuente/jefe/don_grunon_cuadros.webp,
#  fondo magenta) al sprite del juego:
#   - saca el fondo, separa los cuadros y BORRA EL CINTURÓN (inpainting)
#   - escala todo igual, alinea los pies y arma la hoja assets/sprites/grunon.png
#   - ubica los anteojos (de donde salen los láseres) y la panza (punto débil)
#   - arma la carta de la presentación VS (assets/img/grunon_card.png)
#   - escribe los metadatos en js/data/art-data.js
#
#     python tools/jefe.py      (necesita numpy, scipy, opencv-python, pillow)
#
#  Orden de cuadros en el juego:
#   0 quieto · 1 quieto (rebote) · 2 apunta · 3 dispara · 4 golpe/bolsa · 5 vencido · 6 enojado (2ª fase)
# =====================================================================
import json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'arte-fuente', 'jefe', 'don_grunon_cuadros.webp')
CW, CH = 170, 140        # tamaño de cada cuadro en el juego
TARGET_H = 126           # alto del personaje parado

def load():
    rgb = np.array(Image.open(SRC).convert('RGB')).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # fondo magenta (con tolerancia por la compresión)
    bg = ((r - 255) ** 2 + g ** 2 + (b - 255) ** 2) < 130 ** 2
    bg |= (r > 140) & (b > 140) & (g < 0.45 * np.minimum(r, b))  # borde rosado mezclado
    bg |= (r - g > 45) & (b - g > 45)                             # magenta oscuro mezclado con el contorno
    return rgb.astype(np.uint8), ~bg

def frames(rgb, fg):
    fg = ndimage.binary_opening(fg, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=4))
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    big = [i + 1 for i, s in enumerate(sizes) if s > 8000]
    # piezas sueltas (humo, garras) se suman al cuadro más cercano
    cen = {i: ndimage.center_of_mass(lab == i) for i in range(1, n + 1)}
    for i in range(1, n + 1):
        if i in big: continue
        j = min(big, key=lambda k: (cen[k][0] - cen[i][0]) ** 2 + (cen[k][1] - cen[i][1]) ** 2)
        lab[lab == i] = j
    boxes = []
    for i in big:
        ys, xs = np.where((lab == i) & fg)
        boxes.append((ys.min(), ys.max(), xs.min(), xs.max(), i))
    # filas (arriba / abajo) y de izquierda a derecha
    boxes.sort(key=lambda t: (0 if (t[0] + t[1]) / 2 < 512 else 1, t[2]))
    out = []
    for y0, y1, x0, x1, i in boxes:
        m = (lab[y0:y1 + 1, x0:x1 + 1] == i) & fg[y0:y1 + 1, x0:x1 + 1]
        out.append((rgb[y0:y1 + 1, x0:x1 + 1].copy(), m, (y0, x0)))
    return out

# Zona del cinturón y de la hebilla en cada cuadro de la hoja (coordenadas de la imagen original 1024x1024).
# Si se regenera la hoja con Gemini, revisar estas zonas.
BELTS = [
    {'band': [(105, 376), (355, 376), (355, 430), (105, 430)], 'coin': (198, 384, 265, 455)},   # quieto
    {'band': [(455, 403), (700, 403), (700, 450), (455, 450)], 'coin': (575, 400, 640, 463)},   # enojado
    {'band': [(780, 400), (945, 405), (945, 455), (780, 450)], 'coin': (785, 400, 840, 460), 'perfil': True},   # apunta
    {'band': [(110, 790), (360, 790), (360, 845), (110, 845)], 'coin': (205, 797, 275, 870)},   # dispara
    {'band': [(475, 825), (715, 785), (715, 825), (475, 872)], 'coin': (478, 812, 525, 882), 'perfil': True},   # bolsa arriba
    None,                                                                                          # vencido
]
BELLY = (231, 420)  # centro de la panza en el cuadro quieto (punto débil)

def sin_cinturon(img, m, org, spec):
    """borra el cinturón y la hebilla: cada columna se rellena con un degradé entre la panza de arriba y la de abajo"""
    if not spec: return img, m
    from PIL import ImageDraw
    h, w = m.shape; oy, ox = org
    def poly_mask(draw_fn):
        z = Image.new('L', (w, h), 0); draw_fn(ImageDraw.Draw(z)); return (np.array(z) > 0) & m
    x0, y0, x1, y1 = [v - o for v, o in zip(spec['coin'], (ox, oy, ox, oy))]
    coin = poly_mask(lambda d: d.rectangle([x0, y0, x1, y1], fill=255))
    band = poly_mask(lambda d: d.polygon([(x - ox, y - oy) for x, y in spec['band']], fill=255)) & ~coin
    img = img.copy(); m2 = m.copy()
    # referencia válida: cuerpo verdoso (incluye la sombra oscura de abajo de la panza; no el marrón del cinturón)
    ok = lambda yy, xx, src: 0 <= yy < h and 0 <= xx < w and m2[yy, xx] and not src[yy, xx] and int(img[yy, xx, 1]) >= int(img[yy, xx, 0]) - 2
    def fill(mask, vertical):
        idx = range(w) if vertical else range(h)
        for i in idx:
            line = np.where(mask[:, i] if vertical else mask[i, :])[0]
            if not len(line): continue
            for run in np.split(line, np.where(np.diff(line) > 1)[0] + 1):
                a, b = run[0], run[-1]
                pa = (a - 3, i) if vertical else (i, a - 3); pb = (b + 3, i) if vertical else (i, b + 3)
                va, vb = ok(*pa, mask), ok(*pb, mask)
                if not va and not vb: (m2.__setitem__((run, i) if vertical else (i, run), False)); continue
                def avg(pt, sgn):
                    # promedio de una zona chica (5x5) del lado de afuera: evita rayas por la textura del pelo
                    yy0, xx0 = pt; acc = []
                    for dd in range(0, 5):
                        for ee in range(-2, 3):
                            yy, xx = (yy0 + sgn * dd, xx0 + ee) if vertical else (yy0 + ee, xx0 + sgn * dd)
                            if ok(yy, xx, mask): acc.append(img[yy, xx].astype(float))
                    return np.mean(acc, 0) if acc else img[pt].astype(float)
                ca = avg(pa, -1) if va else avg(pb, 1)
                cb = avg(pb, 1) if vb else ca
                if not vertical and va != vb:
                    # la hebilla sobresalía del cuerpo (vista de perfil): se reconstruye el borde de la panza
                    # interpolando dónde estaba el contorno arriba y abajo de la hebilla
                    rows = np.where(mask.any(1))[0]; ya, yb = max(0, rows.min() - 2), min(h - 1, rows.max() + 2)
                    edge_at = (lambda yy: np.where(m2[yy])[0].min()) if vb else (lambda yy: np.where(m2[yy])[0].max())
                    try: ea, eb = edge_at(ya), edge_at(yb)
                    except ValueError: ea = eb = (a if vb else b)
                    tt = (i - ya) / max(1, yb - ya); xe = int(round(ea + (eb - ea) * tt))
                    col = cb if vb else ca
                    for k in run:
                        inside = k >= xe if vb else k <= xe
                        if inside: img[i, k] = col.astype(np.uint8); m2[i, k] = True
                        else: m2[i, k] = False
                    if a <= xe <= b: img[i, xe] = (14, 24, 30)
                    continue
                for k in run:
                    t = (k - a + 1) / (b - a + 2); c = (ca * (1 - t) + cb * t).astype(np.uint8)
                    if vertical: img[k, i] = c; m2[k, i] = True
                    else: img[i, k] = c; m2[i, k] = True
    if spec.get('perfil'):
        fill(band, True)    # cinturón: degradé panza de arriba -> panza de abajo
        fill(coin, False)   # hebilla (sobresale del cuerpo): se rehace el borde de la panza
    else:
        # de frente: una sola franja pareja desde el borde de arriba del cinturón hasta el de abajo de la hebilla
        bx_ = [x - ox for x, y in spec['band']]; by_ = [y - oy for x, y in spec['band']]
        zone = poly_mask(lambda d: d.rectangle([min(bx_), min(by_), max(bx_), max(max(by_), y1)], fill=255))
        fill(zone, True)
    return img, m2

def to_rgba(img, m):
    a = (m * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([img, a]), 'RGBA')

def main():
    rgb, fg = load()
    fr = frames(rgb, fg)
    assert len(fr) == 6, 'esperaba 6 cuadros, encontré %d' % len(fr)
    # 0 quieto, 1 enojado, 2 apunta, 3 dispara, 4 bolsa arriba, 5 vencido (orden de la hoja)
    cleaned = []
    for i, (img, m, org) in enumerate(fr):
        cleaned.append(sin_cinturon(img, m, org, BELTS[i]))
    belly = (BELLY[0] - fr[0][2][1], BELLY[1] - fr[0][2][0])
    s = TARGET_H / cleaned[0][1].shape[0]
    def scaled(i):
        img, m = cleaned[i]
        h, w = m.shape; nw, nh = max(1, round(w * s)), max(1, round(h * s))
        im = to_rgba(img, m)
        small = im.resize((nw, nh), Image.NEAREST)  # el original ya es pixel art: muestrear sin mezclar colores
        return small
    sm = [scaled(i) for i in range(6)]
    def cell(im, dy=0):
        c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        a = np.array(im)[..., 3] > 0
        low = a[int(a.shape[0] * 0.75):]                          # alinear por los pies
        cxs = np.where(low.any(0))[0]; cx = (cxs.min() + cxs.max()) / 2 if len(cxs) else im.width / 2
        x = int(round(CW / 2 - cx)); y = CH - im.height + dy
        c.alpha_composite(im, (max(-im.width, x), y)) if x >= 0 and y >= 0 else c.paste(im, (x, y), im)
        return c, x, y
    order = [(0, 0), (0, 2), (2, 0), (3, 0), (4, 0), (5, 0), (1, 0)]  # (cuadro de la hoja, desplazamiento vertical)
    cells = []; idle_off = None
    for k, (src, dy) in enumerate(order):
        c, x, y = cell(sm[src], dy)
        spec = BELTS[src]
        if spec and spec.get('perfil'):  # retoque final de la hebilla de perfil: cada fila toma el color de la panza de al lado
            org = fr[src][2]; x0, y0, x1, y1 = spec['coin']
            bx0, by0 = int((x0 - org[1]) * s) + x - 1, int((y0 - org[0]) * s) + y - 1
            bx1, by1 = int((x1 - org[1]) * s) + x + 2, int((y1 - org[0]) * s) + y + 2
            a = np.array(c)
            for yy in range(max(0, by0), min(CH, by1)):
                ref = None
                for xx in range(bx1, min(CW, bx1 + 6)):
                    px = a[yy, xx]
                    if px[3] and int(px[1]) > int(px[0]): ref = px.copy(); break
                if ref is None and src not in (2, 4):  # de frente: probar del lado izquierdo
                    for xx in range(bx0, max(-1, bx0 - 6), -1):
                        px = a[yy, xx]
                        if px[3] and int(px[1]) > int(px[0]): ref = px.copy(); break
                if ref is None: continue
                row = [xx for xx in range(max(0, bx0), min(CW, bx1)) if a[yy, xx, 3]]
                for xx in row: a[yy, xx] = ref
                if row and src in (2, 4): a[yy, row[0]] = (14, 24, 30, 255)  # de perfil, el borde lleva contorno
            c = Image.fromarray(a, 'RGBA')
        cells.append(c)
        if k == 0: idle_off = (x, y)
    sheet = Image.new('RGBA', (CW * len(cells), CH))
    for i, c in enumerate(cells): sheet.alpha_composite(c, (i * CW, 0))
    sheet.save(os.path.join(ROOT, 'assets', 'sprites', 'grunon.png'))
    # anteojos (rojo izquierdo, verde derecho) en el cuadro quieto, y la panza
    def lenses(c):
        a = np.array(c).astype(int); top = a[: int(CH * 0.6)]
        on = top[..., 3] > 0
        red = (top[..., 0] > 170) & (top[..., 1] < 90) & (top[..., 2] < 90)
        grn = (top[..., 1] > 150) & (top[..., 0] < 150) & (top[..., 2] < 150)
        wht = (top[..., 0] > 215) & (top[..., 1] > 215) & (top[..., 2] > 215)
        lab, n = ndimage.label((red | grn | wht) & on)
        if n < 2: return None
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); best = np.argsort(sizes)[-2:] + 1
        pts = sorted([tuple(int(v) for v in ndimage.center_of_mass(lab == i))[::-1] for i in best])
        return [pts[0][0], pts[0][1], pts[1][0], pts[1][1]]
    perFrame = [lenses(c) for c in cells]
    lensL = perFrame[0][:2]; lensR = perFrame[0][2:]
    perFrame = [f if f else perFrame[0] for f in perFrame]
    core = [int(belly[0] * s + idle_off[0]), int(belly[1] * s + idle_off[1])] if belly else [CW // 2, CH - 50]
    # carta VS: el que se ríe, grande, sobre fondo rojo con nieve
    W, H = 404, 390
    card = Image.new('RGBA', (W, H)); d = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        t = y / H; d[y, :, :3] = (int(7 + 85 * t), int(6 + 8 * t), int(15 + 18 * t)); d[y, :, 3] = 255
    rng = np.random.default_rng(2)
    for _ in range(140): yy, xx2 = rng.integers(0, H - 2), rng.integers(0, W - 2); d[yy:yy + 2, xx2:xx2 + 2, :3] = (244, 248, 255)
    card = Image.fromarray(d, 'RGBA')
    big = cells[3].resize((CW * 3, CH * 3), Image.NEAREST)
    card.alpha_composite(big, (W // 2 - big.width // 2, H - big.height + 30))
    card.convert('RGB').save(os.path.join(ROOT, 'assets', 'img', 'grunon_card.png'))
    # metadatos
    path = os.path.join(ROOT, 'js', 'data', 'art-data.js')
    src = open(path, encoding='utf-8').read()
    data = json.loads(re.search(r'window\.ART_DATA=(\{.*\});?\s*$', src, re.S).group(1))
    data['sprites'].pop('noel', None)
    data['sprites']['grunon'] = {'w': CW, 'h': CH, 'n': len(cells), 'lensL': lensL, 'lensR': lensR, 'lenses': perFrame, 'core': core}
    open(path, 'w', encoding='utf-8').write('// Metadatos del arte 8-bit (generado por tools/arte.py y tools/jefe.py)\nwindow.ART_DATA=' + json.dumps(data, ensure_ascii=False) + ';\n')
    print('Don Gruñón listo · escala %.3f · lentes %s %s · panza %s' % (s, lensL, lensR, core))

if __name__ == '__main__':
    main()
