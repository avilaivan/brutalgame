# =====================================================================
#  JEFE FINAL: DON GRUÑÓN
#  Convierte la hoja de cuadros hecha con Gemini (arte-fuente/jefe/
#  don_grunon_cuadros_gorro.jpg: 7 poses sobre fondo magenta, con gorro
#  navideño y sin cinturón) al sprite del juego:
#   - saca el fondo magenta y separa los cuadros
#   - espeja las poses que miran a la derecha (el jefe mira a la izquierda)
#   - reduce con promedio + paleta fija sacada del original (pixel art nítido)
#   - alinea los pies y ubica los anteojos de cada pose y la panza
#   - arma la carta de la presentación VS y escribe los metadatos
#
#     python tools/jefe.py      (necesita numpy, scipy y pillow)
#
#  Cuadros en el juego:
#   0 quieto · 1 quieto (rebote) · 2 apunta · 3 dispara · 4 golpe con la bolsa · 5 vencido · 6 enojado
# =====================================================================
import json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), 'arte-fuente', 'jefe', 'don_grunon_cuadros_gorro.jpg')
CW, CH = 176, 150        # tamaño de cada cuadro en el juego
TARGET_H = 138           # alto del cuadro quieto (con gorro)
# orden de la hoja: arriba quieto, rebote, apunta, dispara · abajo golpe, enojado, vencido
SHEET_TO_GAME = [0, 1, 2, 3, 4, 6, 5]
FLIP = {2, 4}            # en la hoja miran a la derecha

def load():
    rgb = np.array(Image.open(SRC).convert('RGB')).astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    bg = ((r - 255) ** 2 + g ** 2 + (b - 255) ** 2) < 140 ** 2        # magenta (con margen por el JPG)
    bg |= (r - g > 70) & (b - g > 70)                                 # halo rosado/violeta del borde
    fg = ndimage.binary_opening(~bg, iterations=2)
    return rgb.astype(np.uint8), fg

def frames(rgb, fg):
    H = fg.shape[0]
    lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    big = [i + 1 for i, s in enumerate(sizes) if s > 30000]
    cen = {i: ndimage.center_of_mass(lab == i) for i in range(1, n + 1)}
    for i in range(1, n + 1):  # humo, vapor, garras sueltas: al cuadro más cercano
        if i in big: continue
        j = min(big, key=lambda k: (cen[k][0] - cen[i][0]) ** 2 + (cen[k][1] - cen[i][1]) ** 2)
        lab[lab == i] = j
    boxes = []
    for i in big:
        ys, xs = np.where((lab == i) & fg)
        boxes.append((ys.min(), ys.max(), xs.min(), xs.max(), i))
    boxes.sort(key=lambda t: (0 if (t[0] + t[1]) / 2 < H / 2 else 1, t[2]))
    out = []
    for y0, y1, x0, x1, i in boxes:
        m = (lab[y0:y1 + 1, x0:x1 + 1] == i) & fg[y0:y1 + 1, x0:x1 + 1]
        a = (m * 255).astype(np.uint8)
        out.append(Image.fromarray(np.dstack([rgb[y0:y1 + 1, x0:x1 + 1], a]), 'RGBA'))
    return out

def main():
    rgb, fg = load()
    fr = frames(rgb, fg)
    assert len(fr) == 7, 'esperaba 7 cuadros, encontré %d' % len(fr)
    fr = [f.transpose(Image.FLIP_LEFT_RIGHT) if i in FLIP else f for i, f in enumerate(fr)]
    s = TARGET_H / fr[0].height
    # paleta fija sacada del original a tamaño completo (colores vivos, sin mezcla sucia)
    allpx = Image.new('RGB', (sum(f.width for f in fr), max(f.height for f in fr)))
    xx = 0
    for f in fr:
        bgfill = Image.new('RGB', f.size, (40, 60, 50)); bgfill.paste(f.convert('RGB'), mask=f.getchannel('A'))
        allpx.paste(bgfill, (xx, 0)); xx += f.width
    pal = allpx.quantize(72, method=Image.Quantize.MEDIANCUT)
    def shrink(f):
        nw, nh = max(1, round(f.width * s)), max(1, round(f.height * s))
        small = f.convert('RGBa').resize((nw, nh), Image.BOX).convert('RGBA')   # promedio con alfa premultiplicado
        a = np.array(small.getchannel('A')); alpha = Image.fromarray(np.where(a > 120, 255, 0).astype(np.uint8))
        q = small.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA'); q.putalpha(alpha)
        return q
    sm = [shrink(f) for f in fr]
    def cell(im):
        c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        a = np.array(im)[..., 3] > 0
        low = a[int(a.shape[0] * 0.8):]                               # alinear por los pies
        cols = np.where(low.any(0))[0]; cx = (cols.min() + cols.max()) / 2 if len(cols) else im.width / 2
        x = int(round(CW / 2 - cx)); y = CH - im.height
        c.paste(im, (x, y), im)
        return c, x, y
    cells = [None] * 7
    for i, im in enumerate(sm):
        cells[SHEET_TO_GAME[i]] = cell(im)[0]
    sheet = Image.new('RGBA', (CW * 7, CH))
    for i, c in enumerate(cells): sheet.alpha_composite(c, (i * CW, 0))
    sheet.save(os.path.join(ROOT, 'assets', 'sprites', 'grunon.png'))

    # anteojos de cada pose (medidos a mano sobre la hoja: el gorro también es rojo y blanco y confunde
    # a cualquier detección automática). [x ojo izq, y, x ojo der, y] en coordenadas del cuadro.
    # Si se cambia la hoja de Gemini, volver a medirlos.
    per = [[79, 42, 96, 42],   # 0 quieto
           [79, 42, 96, 42],   # 1 rebote
           [46, 48, 57, 48],   # 2 apunta (de perfil)
           [80, 42, 96, 42],   # 3 dispara
           [54, 53, 66, 53],   # 4 golpe con la bolsa
           [79, 42, 96, 42],   # 5 vencido (no dispara)
           [79, 57, 95, 57]]   # 6 enojado
    # panza (punto débil que brilla en el descanso): centro de la parte iluminada del cuadro quieto
    a = np.array(cells[0]).astype(int)
    lit = (a[..., 3] > 0) & (a[..., 1] > 120) & (a[..., 1] > a[..., 0] + 30)
    lit[: int(CH * 0.45)] = False
    ys, xs = np.where(lit); core = [int(xs.mean()), int(ys.mean())] if len(xs) else [CW // 2, CH - 50]

    # carta VS: el que se ríe, grande, sobre fondo rojo con nieve
    W, H = 404, 390
    d = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        t = y / H; d[y, :, :3] = (int(7 + 85 * t), int(6 + 8 * t), int(15 + 18 * t)); d[y, :, 3] = 255
    rng = np.random.default_rng(2)
    for _ in range(140): yy, x2 = rng.integers(0, H - 2), rng.integers(0, W - 2); d[yy:yy + 2, x2:x2 + 2, :3] = (244, 248, 255)
    card = Image.fromarray(d, 'RGBA')
    big = cells[3].resize((CW * 3, CH * 3), Image.NEAREST)
    card.alpha_composite(big, (W // 2 - big.width // 2, H - big.height + 40))
    card.convert('RGB').save(os.path.join(ROOT, 'assets', 'img', 'grunon_card.png'))

    path = os.path.join(ROOT, 'js', 'data', 'art-data.js')
    src = open(path, encoding='utf-8').read()
    data = json.loads(re.search(r'window\.ART_DATA=(\{.*\});?\s*$', src, re.S).group(1))
    data['sprites']['grunon'] = {'w': CW, 'h': CH, 'n': 7, 'lensL': per[0][:2], 'lensR': per[0][2:], 'lenses': per, 'core': core}
    open(path, 'w', encoding='utf-8').write('// Metadatos del arte 8-bit (generado por tools/arte.py y tools/jefe.py)\nwindow.ART_DATA=' + json.dumps(data, ensure_ascii=False) + ';\n')
    print('Don Gruñón listo · escala %.3f · anteojos %s · panza %s' % (s, per, core))

if __name__ == '__main__':
    main()
