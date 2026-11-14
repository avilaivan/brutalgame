# -*- coding: utf-8 -*-
"""Convierte el video del logo del menú en cuadros 8-bit que el juego reproduce siempre:
   la ENTRADA una vez y después la parte que titila EN LOOP, sin sonido y sin controles.
   (El navegador no reproduce video con transparencia en todos los equipos, y un video con pantalla
   verde no se puede recortar en vivo sin servidor: por eso se pasa a cuadros. Funciona igual en PC y celular.)

   Acepta:
     - video con pantalla verde (.mp4):   --verde
     - video con transparencia (.mov ProRes 4444 / .webm con alpha)
     - una carpeta de PNG con transparencia
   Necesita ffmpeg, Pillow, numpy y opencv.

   Uso (desde salva-la-navidance):
     python tools/video_menu.py "../arte-fuente/FONT Y VIDEOS ANIMADOS/SALVA LA NAVIDANCE INFINITO.mp4" --verde
   Opciones: --entrada 0-6 (segundos de la entrada)  --loop 6-14 (segundos que se repiten)
             --fps 12  --ancho 380  --colores 96
   Genera assets/img/menu_intro.png, assets/img/menu_loop.png y js/data/menu-anim.js.
"""
import sys, os, glob, json, subprocess, tempfile, argparse
import numpy as np
import cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def chroma(rgb):
    """Saca la pantalla verde. Mantiene las hojas de acebo (verde oliva, manchas grandes) y limpia
    el borde verdoso fino que queda alrededor del brillo rojo."""
    a = rgb.astype(np.float32)
    bg = np.median(np.concatenate([a[:24, :24].reshape(-1, 3), a[:24, -24:].reshape(-1, 3), a[-24:, :24].reshape(-1, 3), a[-24:, -24:].reshape(-1, 3)]), axis=0)
    dom = a[..., 1] - np.maximum(a[..., 0], a[..., 2])          # cuánto domina el verde
    bgdom = bg[1] - max(bg[0], bg[2])
    hi, lo = bgdom * 0.8, bgdom * 0.48
    alpha = np.clip((hi - dom) / (hi - lo), 0, 1)
    olive = ((a[..., 1] > a[..., 0]) & (a[..., 1] > a[..., 2]) & (alpha > 0)).astype(np.uint8)
    thick = cv2.dilate(cv2.morphologyEx(olive, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)), np.ones((3, 3), np.uint8))
    fringe = (olive == 1) & (thick == 0)
    out = a.copy()
    # despill general: el verde no puede superar al rojo/azul salvo en las hojas
    m = np.maximum(a[..., 0], a[..., 2])
    out[..., 1] = np.where(thick == 1, a[..., 1], np.minimum(a[..., 1], m))
    # el borde fino pasa a ser parte del brillo rojo
    out[fringe] = np.stack([np.minimum(255, a[fringe][:, 0] * 1.5 + 40), a[fringe][:, 1] * 0.3, a[fringe][:, 2] * 0.7 + 20], axis=1)
    alpha = np.where(fringe, alpha * 0.7, alpha)
    return np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8)


def read_frames(src, t0, t1, fps, verde, tmp):
    d = os.path.join(tmp, '%g_%g' % (t0, t1)); os.makedirs(d, exist_ok=True)
    if os.path.isdir(src):
        files = sorted(glob.glob(os.path.join(src, '*.png')))
        k0, k1 = int(t0 * 15), int(t1 * 15)  # las carpetas del .bat salen a 15 cuadros/s
        files = files[k0:k1:max(1, round(15 / fps))]
        return [np.array(Image.open(f).convert('RGBA')) for f in files]
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t0), '-t', str(t1 - t0), '-i', src, '-an', '-vf', 'fps=%g' % fps,
                    '-pix_fmt', 'rgb24' if verde else 'rgba', os.path.join(d, 'f%05d.png')], check=True)
    out = []
    for f in sorted(glob.glob(os.path.join(d, '*.png'))):
        im = np.array(Image.open(f).convert('RGB' if verde else 'RGBA'))
        out.append(chroma(im) if verde else im)
    return out


def shrink(f, scale):
    h, w = f.shape[:2]
    p = f.astype(np.float32) / 255.0; p[..., :3] *= p[..., 3:4]
    r = cv2.resize(p, (max(1, round(w * scale)), max(1, round(h * scale))), interpolation=cv2.INTER_AREA)
    al = r[..., 3:4]; rgb = np.where(al > 1e-3, r[..., :3] / np.maximum(al, 1e-3), 0)
    o = np.dstack([rgb, (al[..., 0] >= 0.42).astype(np.float32)]); o[..., :3] *= o[..., 3:4]
    return (np.clip(o, 0, 1) * 255).round().astype(np.uint8)


def sheet(frames, name, pal):
    h, w = frames[0].shape[:2]
    cols = max(1, min(len(frames), int(4000 // w))); rows = int(np.ceil(len(frames) / cols))
    out = Image.new('RGBA', (cols * w, rows * h))
    for i, s in enumerate(frames):
        q = np.array(Image.fromarray(s[..., :3]).quantize(palette=pal, dither=Image.NONE).convert('RGB'))
        out.paste(Image.fromarray(np.dstack([q, s[..., 3]])), ((i % cols) * w, (i // cols) * h))
    out.save(os.path.join(ROOT, 'assets', 'img', name), optimize=True)
    return {'n': len(frames), 'cols': cols, 'file': 'assets/img/' + name}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('--verde', action='store_true')
    ap.add_argument('--entrada', default='0-6'); ap.add_argument('--loop', default='6-14')
    ap.add_argument('--fps', type=float, default=12); ap.add_argument('--ancho', type=int, default=380); ap.add_argument('--colores', type=int, default=96)
    a = ap.parse_args()
    e0, e1 = map(float, a.entrada.split('-')); l0, l1 = map(float, a.loop.split('-'))
    tmp = tempfile.mkdtemp()
    intro = read_frames(a.src, e0, e1, a.fps, a.verde, tmp)
    loop = read_frames(a.src, l0, l1, a.fps, a.verde, tmp)
    if not loop: sys.exit('No se pudieron leer cuadros del video')
    # loop sin salto: los últimos cuadros se funden con los primeros
    X = min(6, len(loop) // 4)
    for i in range(X):
        t = (i + 1) / (X + 1); j = len(loop) - X + i
        A = loop[j].astype(np.float32); B = loop[i].astype(np.float32)
        loop[j] = (A * (1 - t) + B * t).astype(np.uint8)
    allf = intro + loop
    alpha = np.max([f[..., 3] for f in allf], axis=0) > 100
    if not alpha.any(): sys.exit('El video no tiene transparencia: si es de pantalla verde, agregá --verde')
    ys, xs = np.where(alpha.any(axis=1))[0], np.where(alpha.any(axis=0))[0]
    crop = lambda f: f[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
    scale = a.ancho / (xs[-1] - xs[0] + 1)
    intro = [shrink(crop(f), scale) for f in intro]; loop = [shrink(crop(f), scale) for f in loop]
    px = np.concatenate([s[s[..., 3] > 0][:, :3] for s in intro + loop if (s[..., 3] > 0).any()])
    pal = Image.fromarray(px[::7].reshape(-1, 1, 3)).quantize(a.colores, method=Image.MEDIANCUT, dither=Image.NONE)
    h, w = loop[0].shape[:2]
    meta = {'w': w, 'h': h, 'fps': a.fps, 'loop': sheet(loop, 'menu_loop.png', pal)}
    if intro: meta['intro'] = sheet(intro, 'menu_intro.png', pal)
    with open(os.path.join(ROOT, 'js', 'data', 'menu-anim.js'), 'w', encoding='utf-8') as f:
        f.write('// Animación del logo del menú (generada por tools/video_menu.py): entrada una vez + loop\nwindow.MENU_ANIM = ' + json.dumps(meta) + ';\n')
    print('listo:', meta)


if __name__ == '__main__':
    main()
