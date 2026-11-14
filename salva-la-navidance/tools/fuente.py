# -*- coding: utf-8 -*-
"""Fuente AKIRA en 8-bit.
   - AKIRA8 (chica, 6x7): redibujada a mano píxel por píxel con las proporciones de Akira Expanded
     (trazo grueso, formas cuadradas). Se usa en textos chicos y medianos.
   - AKIRA8 ANCHA (7 de alto, ancho real): Akira Expanded pasada a píxeles; se usa en los títulos.
   La demo de Akira no trae acentos, Ñ ni ¡ ¿: acá se arman a partir de la letra base.
   Genera js/data/font-data.js y assets/fonts/akira8.ttf (para el formulario HTML).
   Uso (desde salva-la-navidance):  python tools/fuente.py
"""
import os, json, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OTF = os.path.join(ROOT, '..', 'arte-fuente', 'FONT Y VIDEOS ANIMADOS', 'Akira Expanded Demo.otf')

SMALL = {
 'A': ['.####.', '######', '##..##', '##..##', '######', '##..##', '##..##'],
 'B': ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.'],
 'C': ['.####.', '######', '##....', '##....', '##....', '######', '.####.'],
 'D': ['#####.', '######', '##..##', '##..##', '##..##', '######', '#####.'],
 'E': ['######', '######', '##....', '#####.', '##....', '######', '######'],
 'F': ['######', '######', '##....', '#####.', '##....', '##....', '##....'],
 'G': ['.####.', '######', '##....', '##.###', '##..##', '######', '.####.'],
 'H': ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
 'I': ['##', '##', '##', '##', '##', '##', '##'],
 'J': ['....##', '....##', '....##', '....##', '##..##', '######', '.####.'],
 'K': ['##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##'],
 'L': ['##....', '##....', '##....', '##....', '##....', '######', '######'],
 'M': ['##....##', '###..###', '########', '##.##.##', '##....##', '##....##', '##....##'],
 'N': ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##'],
 'O': ['.####.', '######', '##..##', '##..##', '##..##', '######', '.####.'],
 'P': ['#####.', '######', '##..##', '######', '#####.', '##....', '##....'],
 'Q': ['.####.', '######', '##..##', '##..##', '##.##.', '#####.', '.##.##'],
 'R': ['#####.', '######', '##..##', '#####.', '####..', '##.##.', '##..##'],
 'S': ['.#####', '######', '##....', '.####.', '....##', '######', '#####.'],
 'T': ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..'],
 'U': ['##..##', '##..##', '##..##', '##..##', '##..##', '######', '.####.'],
 'V': ['##...##', '##...##', '.##.##.', '.##.##.', '..###..', '..###..', '...#...'],
 'W': ['##....##', '##....##', '##....##', '##.##.##', '########', '###..###', '##....##'],
 'X': ['##...##', '.##.##.', '..###..', '..###..', '..###..', '.##.##.', '##...##'],
 'Y': ['##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..'],
 'Z': ['######', '######', '...##.', '..##..', '.##...', '######', '######'],
 '0': ['.####.', '##..##', '##.###', '######', '###.##', '##..##', '.####.'],
 '1': ['..##..', '.###..', '####..', '..##..', '..##..', '######', '######'],
 '2': ['.####.', '##..##', '....##', '..###.', '.##...', '######', '######'],
 '3': ['#####.', '....##', '....##', '.####.', '....##', '....##', '#####.'],
 '4': ['...###', '..####', '.##.##', '##..##', '######', '....##', '....##'],
 '5': ['######', '##....', '#####.', '....##', '....##', '##..##', '.####.'],
 '6': ['.####.', '##....', '#####.', '##..##', '##..##', '##..##', '.####.'],
 '7': ['######', '######', '....##', '...##.', '..##..', '..##..', '..##..'],
 '8': ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '.####.'],
 '9': ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '.####.'],
 '.': ['..', '..', '..', '..', '..', '##', '##'],
 ',': ['..', '..', '..', '..', '..', '##', '.#'],
 ':': ['..', '##', '##', '..', '..', '##', '##'],
 '!': ['##', '##', '##', '##', '..', '##', '##'],
 '?': ['.####.', '##..##', '....##', '..###.', '..##..', '......', '..##..'],
 '-': ['....', '....', '....', '####', '....', '....', '....'],
 '+': ['......', '..##..', '..##..', '######', '..##..', '..##..', '......'],
 '·': ['..', '..', '..', '##', '##', '..', '..'],
 "'": ['##', '##', '..', '..', '..', '..', '..'],
 '&': ['.###...', '##.##..', '.###...', '.###.##', '##.###.', '##..##.', '.###.##'],
}
SMALL['¡'] = SMALL['!'][::-1]
SMALL['¿'] = [r[::-1] for r in SMALL['?'][::-1]]

ACUTE = {'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U'}


def pts(rows, y0=0):
    return [(x, y + y0) for y, r in enumerate(rows) for x, c in enumerate(r) if c == '#']


def accent(base_rows, kind):
    w = len(base_rows[0]); p = pts(base_rows)
    if kind == 'acute':
        if w <= 2: p += [(1, -2), (0, -2)] if False else [(1, -3), (0, -2), (1, -2)]
        else: c = w // 2; p += [(c, -3), (c + 1, -3), (c - 1, -2), (c, -2)]
    elif kind == 'tilde': p += [(x, -2) for x in range(1, w - 1)] + [(0, -1 - 1)] * 0
    elif kind == 'uml': p += [(0, -2), (1, -2), (w - 2, -2), (w - 1, -2)]
    return w, p


def wide_set():
    """Akira Expanded real, llevada a 7 píxeles de alto (para títulos)."""
    F = ImageFont.truetype(OTF, 1000)
    T, B = F.getbbox('H')[1], F.getbbox('H')[3]
    out = {}
    for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':
        b = F.getbbox(ch); w = b[2] - b[0]
        im = Image.new('L', (w, B - T), 0); ImageDraw.Draw(im).text((-b[0], -T), ch, font=F, fill=255)
        tw = max(2, int(round(w * 7 / (B - T) * 0.84)))
        a = np.array(im.resize((tw, 7), Image.BOX)) / 255.0 > 0.5
        out[ch] = [''.join('#' if v else '.' for v in r) for r in a]
    # retoques a mano donde la reducción automática confunde letras
    g = [list(r) for r in out['C']]; w = len(g[0])
    for x in range(w // 2, w): g[3][x] = '#'
    g[4][w - 1] = g[4][w - 2] = '#'
    out['G'] = [''.join(r) for r in g]
    for d in '0123456789': out[d] = SMALL[d]
    # & ancho y grueso, del mismo peso que las letras anchas de Akira
    out['&'] = ['..###....', '.##.##...', '.##.##...', '..###..##', '.##.####.', '##...##..', '.####.###']
    for k in ('.', ',', ':', '!', '?', '-', '+', '·', "'", '¡', '¿'):
        out[k] = [''.join(c * (1 if k in '.,:!¡\'·' else 1) for c in r) for r in SMALL[k]]
    return out


def build(rows_by_char):
    D = {}
    for ch, rows in rows_by_char.items(): D[ch] = (len(rows[0]), pts(rows))
    for a, b in ACUTE.items(): D[a] = accent(rows_by_char[b], 'acute')
    D['Ñ'] = accent(rows_by_char['N'], 'tilde'); D['Ü'] = accent(rows_by_char['U'], 'uml')
    for ch in list(D):  # Akira es todo mayúsculas: las minúsculas usan el mismo dibujo
        lo = ch.lower()
        if lo != ch: D[lo] = D[ch]
    return D


def to_js(D):
    return {ch: [w, ';'.join('%d,%d' % p for p in sorted(set(pp), key=lambda q: (q[1], q[0])))] for ch, (w, pp) in D.items()}


def make_ttf(D, path, name='Akira8'):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    U = 100; upm = 1100
    fb = FontBuilder(upm, isTTF=True)
    order = ['.notdef', 'space']; cmap = {32: 'space'}; glyphs = {}; adv = {'.notdef': (600, 0), 'space': (400, 0)}
    pen = TTGlyphPen(None); glyphs['.notdef'] = pen.glyph(); pen = TTGlyphPen(None); glyphs['space'] = pen.glyph()
    for ch, (w, pp) in D.items():
        gn = 'u%04X' % ord(ch); order.append(gn); cmap[ord(ch)] = gn
        pen = TTGlyphPen(None)
        for x, y in set(pp):
            x0, y0 = x * U, (6 - y) * U
            pen.moveTo((x0, y0)); pen.lineTo((x0, y0 + U)); pen.lineTo((x0 + U, y0 + U)); pen.lineTo((x0 + U, y0)); pen.closePath()
        glyphs[gn] = pen.glyph(); adv[gn] = ((w + 1) * U, 0)
    fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(adv)
    fb.setupHorizontalHeader(ascent=1000, descent=-200); fb.setupNameTable({'familyName': name, 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=1000, sTypoDescender=-200, usWinAscent=1000, usWinDescent=200); fb.setupPost(); fb.save(path)


def main():
    old_p = os.path.join(ROOT, 'js', 'data', 'font-data.js')
    src = open(old_p, encoding='utf-8').read()
    old = json.loads(re.search(r'FONT_DATA=(\{.*?\});', src, re.S).group(1))
    small = to_js(build(SMALL)); wide = to_js(build(wide_set()))
    # símbolos que Akira no tiene (flechas, corazón, estrella, @...): quedan los de la fuente pixel anterior
    for ch, v in old.items():
        if ch not in small and not ch.isalpha(): small[ch] = v
    with open(old_p, 'w', encoding='utf-8') as f:
        f.write('// Fuente AKIRA 8-bit (generada por tools/fuente.py desde Akira Expanded): chica y ancha para títulos\n')
        f.write('window.FONT_DATA=' + json.dumps(small, ensure_ascii=False) + ';\n')
        f.write('window.FONT_WIDE=' + json.dumps(wide, ensure_ascii=False) + ';\n')
    D = {}
    for ch, (w, p) in small.items(): D[ch] = (w, [tuple(map(int, q.split(','))) for q in p.split(';')] if p else [])
    make_ttf(D, os.path.join(ROOT, 'assets', 'fonts', 'akira8.ttf'))
    print('fuente lista:', len(small), 'chicos,', len(wide), 'anchos')


if __name__ == '__main__':
    main()
