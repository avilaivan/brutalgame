# -*- coding: utf-8 -*-
"""Utilidades para recortar cuadros de las hojas de animación (arte-fuente/ASSETS AGREGADOS).

Las hojas vienen con fondo liso (blanco o gris), números y títulos. Acá se:
  1. saca el fondo (relleno desde los bordes: lo blanco de ADENTRO del personaje se conserva),
  2. separan los personajes (componentes grandes) y se les pegan chispas/humo/polvo cercanos,
  3. descartan números, títulos, líneas de piso y sombras.
Necesita Pillow, numpy y opencv (pip install pillow numpy opencv-python).
"""
import numpy as np
import cv2
from PIL import Image


def load(path):
    return np.array(Image.open(path).convert('RGB'))


def fg_mask(rgb, tol=26, holes=0):
    """Fondo = todo lo que se alcanza desde el borde con color parecido al de las esquinas."""
    h, w, _ = rgb.shape
    cs = np.array([rgb[2, 2], rgb[2, w - 3], rgb[h - 3, 2], rgb[h - 3, w - 3]], dtype=np.int32)
    bg = np.median(cs, axis=0)
    close = (np.abs(rgb.astype(np.int32) - bg).max(axis=2) <= tol).astype(np.uint8)
    # relleno desde el borde sobre los píxeles "parecidos al fondo"
    ff = close.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 8):
        for y in (0, h - 1):
            if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
    for y in range(0, h, 8):
        for x in (0, w - 1):
            if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
    fg = (ff != 2).astype(np.uint8)
    if holes:
        # huecos encerrados con color de fondo (entre el brazo y el cuerpo, bajo la línea de piso)
        n, lab, st, _ = cv2.connectedComponentsWithStats((ff == 1).astype(np.uint8), 4)
        for i in range(1, n):
            if st[i][4] >= holes: fg[lab == i] = 0
    return fg, bg


def components(fg, join=5):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (join, join))
    d = cv2.dilate(fg, k)
    n, lab, st, _ = cv2.connectedComponentsWithStats(d, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        out.append(dict(id=i, x=int(x), y=int(y), w=int(w), h=int(h), a=int(a)))
    return lab, out


def is_label(rgb, lab, c, bg):
    """Números y títulos: chicos, de un solo color plano (negro, bordó, crema)."""
    m = lab[c['y']:c['y'] + c['h'], c['x']:c['x'] + c['w']] == c['id']
    px = rgb[c['y']:c['y'] + c['h'], c['x']:c['x'] + c['w']][m].astype(np.int32)
    if len(px) == 0: return True
    far = px[np.abs(px - bg).max(axis=1) > 60]
    if len(far) < 10: return True
    if far.std(axis=0).max() < 26: return True
    # texto blanco con borde negro: sin píxeles de color (los personajes siempre tienen color)
    mx, mn = far.max(axis=1), far.min(axis=1)
    sat = ((mx - mn) > 70) & (mx > 70)
    return sat.mean() < 0.04


def extract(path, rows=None, min_h=0.16, attach=40, tol=26, drop_labels=True, keep_far=False, holes=0, front=False):
    """Devuelve filas de cuadros: [[RGBA np.array, ...], ...] ordenadas de arriba a abajo / izq. a der.
    min_h: alto mínimo de un personaje (fracción del alto de la hoja).
    attach: distancia (px de la hoja) para pegarle efectos sueltos a un personaje."""
    rgb = load(path); H, W, _ = rgb.shape
    fg, bg = fg_mask(rgb, tol, holes)
    lab, comps = components(fg)
    big = [c for c in comps if c['h'] >= min_h * H]
    small = [c for c in comps if c['h'] < min_h * H and c['a'] > 30]
    for b in big: b['parts'] = [b]
    for s in small:
        if drop_labels and is_label(rgb, lab, s, bg): continue
        best, bd = None, 1e9
        for b in big:
            dx = max(b['x'] - (s['x'] + s['w']), s['x'] - (b['x'] + b['w']), 0)
            dy = max(b['y'] - (s['y'] + s['h']), s['y'] - (b['y'] + b['h']), 0)
            d = max(dx, dy)
            if d < bd: bd, best = d, b
        if front and best is not None and s['x'] + s['w'] / 2 < best['x'] + best['w'] / 2: continue
        if best is not None and (bd <= attach or keep_far): best['parts'].append(s)
    # filas: agrupar por centro vertical
    big.sort(key=lambda c: c['y'] + c['h'] / 2)
    groups = []
    for b in big:
        cy = b['y'] + b['h'] / 2
        if groups and abs(cy - groups[-1]['cy']) < 0.11 * H:
            g = groups[-1]; g['items'].append(b); g['cy'] = sum(i['y'] + i['h'] / 2 for i in g['items']) / len(g['items'])
        else: groups.append(dict(cy=cy, items=[b]))
    out = []
    for g in groups:
        g['items'].sort(key=lambda c: c['x'])
        row = []
        for b in g['items']:
            x0 = min(p['x'] for p in b['parts']); y0 = min(p['y'] for p in b['parts'])
            x1 = max(p['x'] + p['w'] for p in b['parts']); y1 = max(p['y'] + p['h'] for p in b['parts'])
            ids = np.array([p['id'] for p in b['parts']])
            m = np.isin(lab[y0:y1, x0:x1], ids) & (fg[y0:y1, x0:x1] == 1)
            rgba = np.dstack([rgb[y0:y1, x0:x1], (m * 255).astype(np.uint8)])
            # caja del cuerpo (sin efectos) relativa al recorte: sirve para anclar los pies
            row.append(dict(im=rgba, body=(b['x'] - x0, b['y'] - y0, b['w'], b['h']), src=(x0, y0, x1, y1)))
        out.append(row)
    return out


def cut_floor_line(fr, dark=70):
    """Saca la línea negra de piso dibujada bajo los pies (filas inferiores anchas y negras)."""
    im = fr['im']; a = im[..., 3] > 0; h, w = a.shape
    cut = h
    for y in range(h - 1, int(h * 0.8), -1):
        row = a[y]
        if row.sum() < 0.5 * w: continue
        px = im[y][row][:, :3]
        if (px.max(axis=1) < dark).mean() > 0.85: cut = y
    if cut < h:
        # borrar solo los píxeles negros de esas filas (los pies quedan)
        for y in range(cut, h):
            row = a[y]; blk = (im[y][..., :3].max(axis=1) < dark) & row
            # conservar el negro que tiene cuerpo arriba (suela del zapato)
            keep = np.zeros(w, bool)
            if cut - 3 >= 0: keep = a[cut - 3]
            im[y][blk & ~keep, 3] = 0
    return fr


def trim(im):
    a = im[..., 3] > 0
    ys = np.where(a.any(axis=1))[0]; xs = np.where(a.any(axis=0))[0]
    if len(ys) == 0: return im, 0, 0
    return im[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1], xs[0], ys[0]


def downscale(im, scale, sharpen=True, amount=0.6):
    """Achica con promedio de área sobre alfa premultiplicado y deja el borde duro (pixel art)."""
    h, w = im.shape[:2]
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    f = im.astype(np.float32) / 255.0
    f[..., :3] *= f[..., 3:4]
    r = cv2.resize(f, (nw, nh), interpolation=cv2.INTER_AREA)
    a = r[..., 3]
    rgb = np.where(a[..., None] > 1e-3, r[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    if sharpen:
        blur = cv2.GaussianBlur(rgb, (0, 0), 0.8)
        rgb = np.clip(rgb + (rgb - blur) * amount, 0, 1)
    out = np.dstack([rgb, (a >= 0.5).astype(np.float32)])
    out[..., :3] *= out[..., 3:4]
    return (out * 255).round().astype(np.uint8)


def quantize(frames, colors=48):
    """Paleta común para todos los cuadros de un personaje (se ve más 8-bit y pesa menos)."""
    px = np.concatenate([f[f[..., 3] > 0][:, :3] for f in frames if (f[..., 3] > 0).any()])
    pal_im = Image.fromarray(px.reshape(-1, 1, 3)).quantize(colors, method=Image.MEDIANCUT, dither=Image.NONE)
    out = []
    for f in frames:
        q = Image.fromarray(f[..., :3]).quantize(palette=pal_im, dither=Image.NONE).convert('RGB')
        o = np.dstack([np.array(q), f[..., 3]]); o[o[..., 3] == 0] = 0
        out.append(o)
    return out


def contact(rows, path, bg=(50, 50, 70), scale=1.0, pad=6):
    """Hoja de contacto para revisar los recortes a ojo."""
    ims = [[Image.fromarray(f['im'] if isinstance(f, dict) else f) for f in r] for r in rows]
    if scale != 1.0: ims = [[i.resize((max(1, int(i.width * scale)), max(1, int(i.height * scale))), Image.NEAREST) for i in r] for r in ims]
    W = max(sum(i.width + pad for i in r) for r in ims) + pad
    H = sum(max(i.height for i in r) + pad for r in ims) + pad
    out = Image.new('RGB', (W, H), bg); y = pad
    for r in ims:
        x = pad
        for i in r: out.paste(i, (x, y), i); x += i.width + pad
        y += max(i.height for i in r) + pad
    out.save(path)


def extract_grid(path, cols, nrows, tol=26, ybounds=None, corner=0.0):
    """Hojas en grilla (las del jefe): cada componente va ENTERO a la celda donde cae su centro
    (los brazos que invaden la celda vecina no se cortan). Si un fogonazo une dos personajes,
    ese componente se parte en el borde de la celda. corner: descarta lo que esté en la esquina
    superior izquierda de la celda (los números 01, 02...)."""
    rgb = load(path); H, W, _ = rgb.shape
    fg, bg = fg_mask(rgb, tol)
    yb = ybounds or [int(H * r / nrows) for r in range(nrows + 1)]
    cw = W / cols
    lab, comps = components(fg, 1)
    cells = [[[] for _ in range(cols)] for _ in range(nrows)]
    for comp in comps:
        if comp['a'] < 12: continue
        m = lab[comp['y']:comp['y'] + comp['h'], comp['x']:comp['x'] + comp['w']] == comp['id']
        ys, xs = np.where(m); cx, cy = comp['x'] + xs.mean(), comp['y'] + ys.mean()
        r = max(0, min(nrows - 1, int(np.searchsorted(yb, cy) - 1)))
        small = comp['h'] < 0.1 * H
        if small and is_label(rgb, lab, comp, bg): continue
        if comp['w'] > 1.55 * cw:  # dos personajes unidos: partir por columna de celda
            for c in range(cols):
                x0, x1 = int(c * cw), int((c + 1) * cw)
                ax0, ax1 = max(x0, comp['x']), min(x1, comp['x'] + comp['w'])
                if ax1 <= ax0: continue
                sub = m[:, ax0 - comp['x']:ax1 - comp['x']]
                if sub.sum() > 40: cells[r][c].append((ax0, comp['y'], sub))
            continue
        c = max(0, min(cols - 1, int(cx / cw)))
        if corner and small and (cx - c * cw) < corner * cw and (cy - yb[r]) < corner * (yb[r + 1] - yb[r]): continue
        cells[r][c].append((comp['x'], comp['y'], m))
    res = []
    for r in range(nrows):
        row = []
        for c in range(cols):
            parts = cells[r][c]
            if not parts: continue
            x0 = min(p[0] for p in parts); y0 = min(p[1] for p in parts)
            x1 = max(p[0] + p[2].shape[1] for p in parts); y1 = max(p[1] + p[2].shape[0] for p in parts)
            m = np.zeros((y1 - y0, x1 - x0), bool)
            for px, py, sub in parts: m[py - y0:py - y0 + sub.shape[0], px - x0:px - x0 + sub.shape[1]] |= sub
            rgba = np.dstack([rgb[y0:y1, x0:x1], (m * 255).astype(np.uint8)])
            row.append(dict(im=rgba, body=(0, 0, x1 - x0, y1 - y0), src=(x0, y0, x1, y1)))
        res.append(row)
    return res


def tween(a, b, axa, axb, t=0.5):
    """Genera un cuadro intermedio REAL entre a y b (RGBA, misma escala) con flujo óptico:
    los dos se alinean por los pies, se calcula cómo se mueve cada píxel de a hacia b
    y se deforman los dos hasta la mitad del camino. Devuelve (imagen, ancla x)."""
    ha, wa = a.shape[:2]; hb, wb = b.shape[:2]
    left = int(np.ceil(max(axa, axb))) + 8; right = int(np.ceil(max(wa - axa, wb - axb))) + 8
    W, H = left + right, max(ha, hb) + 8
    def put(im, ax):
        c = np.zeros((H, W, 4), np.float32); x0 = int(round(left - ax)); y0 = H - im.shape[0]
        c[y0:y0 + im.shape[0], x0:x0 + im.shape[1]] = im.astype(np.float32) / 255.0
        return c
    A, B = put(a, axa), put(b, axb)
    def gray(c):  # sobre fondo gris medio: el contorno del personaje cuenta para el flujo
        g = c[..., :3].mean(axis=2) * c[..., 3] + 0.45 * (1 - c[..., 3])
        return (g * 255).astype(np.uint8)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    ga, gb = gray(A), gray(B)
    fab = dis.calc(ga, gb, None); fba = dis.calc(gb, ga, None)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    def warp(img, f, k):
        p = img.copy(); p[..., :3] *= p[..., 3:4]
        return cv2.remap(p, xx + k * f[..., 0], yy + k * f[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    Aw = warp(A, fba, t); Bw = warp(B, fab, 1 - t)
    # calidad: si las dos mitades deformadas no coinciden en silueta, el intermedio sale "fantasma"
    ua, ub = Aw[..., 3] > 0.5, Bw[..., 3] > 0.5
    tween.err = float((ua ^ ub).sum()) / max(1, (ua | ub).sum())
    M = Aw * (1 - t) + Bw * t
    al = M[..., 3:4]
    rgb = np.where(al > 1e-3, M[..., :3] / np.maximum(al, 1e-3), 0)
    out = np.dstack([rgb, al[..., 0]]); out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    out, x0, _ = trim(out)
    return out, left - x0


def outline(im, k=0.38):
    """Contorno de 1 píxel: los píxeles del borde de la silueta se oscurecen (como el delineado negro
    de los sprites clásicos). Con el personaje chico, es lo que hace que se lea nítido al moverse."""
    a = (im[..., 3] > 0).astype(np.uint8)
    inner = cv2.erode(a, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT, borderValue=0)
    edge = (a == 1) & (inner == 0)
    out = im.copy()
    out[edge, :3] = (out[edge, :3].astype(np.float32) * k).astype(np.uint8)
    return out
