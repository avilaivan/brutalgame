# -*- coding: utf-8 -*-
"""Analiza una canción (BPM, fase del beat y energía de graves/medios/agudos/golpes a 30 cuadros/s)
   y la agrega a js/data/music-data.js para que las luces y el juego sigan su ritmo.
   Necesita ffmpeg, numpy y scipy.
   Uso (desde salva-la-navidance):  python tools/musica.py menu "FLOWER IN A HURRICANE" assets/music/menu.mp3
"""
import sys, os, json, re, base64, subprocess
import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 22050; FPS = 30


def analyze(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32); dur = len(x) / SR
    hop = 256
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=1024 - hop, boundary=None)
    M = np.abs(Z)
    def band(lo, hi): return M[(f >= lo) & (f < hi)].sum(axis=0)
    bass, mid, high = band(30, 180), band(180, 2500), band(2500, 9000)
    flux = np.maximum(0, np.diff(np.log1p(M * 50), axis=1)).sum(axis=0); flux = np.concatenate([[0], flux])
    fr = SR / hop  # cuadros de análisis por segundo
    # ---- BPM por autocorrelación de los golpes (entre 80 y 170) ----
    o = flux - signal.medfilt(flux, 31); o = np.maximum(o, 0)
    ac = signal.correlate(o, o, mode='full')[len(o) - 1:]
    best, bpm = -1, 120.0
    for b in np.arange(80, 170.01, 0.05):
        lag = 60.0 / b * fr
        s = sum(np.interp(lag * k, np.arange(len(ac)), ac) for k in (1, 2, 4, 8, 16, 32))
        if s > best: best, bpm = s, b
    # ---- fase: desplazamiento que mejor calza una grilla de beats con los golpes ----
    per = 60.0 / bpm; tt = np.arange(len(o)) / fr + 512 / SR
    offs = np.arange(0, per, 0.002); sc = []
    for off in offs:
        ph = ((tt - off) / per) % 1.0
        sc.append((o * np.exp(-((np.minimum(ph, 1 - ph) * per) ** 2) / (2 * 0.012 ** 2))).sum())
    offset = float(offs[int(np.argmax(sc))])
    def env(v):
        v = signal.medfilt(v, 3); n = int(dur * FPS)
        idx = np.clip(((np.arange(n) / FPS - 512 / SR) * fr).astype(int), 0, len(v) - 1)
        e = v[idx]; hi = np.percentile(e, 98) or 1
        e = np.clip(e / hi, 0, 1) ** 0.8
        return base64.b64encode((e * 255).astype(np.uint8).tobytes()).decode()
    return {'bpm': round(float(bpm), 2), 'offset': round(offset, 4), 'duration': round(dur, 3), 'fps': FPS,
            'bass': env(bass), 'mid': env(mid), 'high': env(high), 'onset': env(o)}


def main():
    key, title, path = sys.argv[1], sys.argv[2], sys.argv[3]
    d = analyze(path if os.path.isabs(path) else os.path.join(ROOT, path))
    if key == '-': print('bpm', d['bpm'], 'offset', d['offset'], 'dur', d['duration']); return
    d['title'] = title; d['file'] = path.replace('\\', '/')
    p = os.path.join(ROOT, 'js', 'data', 'music-data.js'); s = open(p, encoding='utf-8').read()
    m = re.search(r'window\.MUSIC_DATA=(\{.*\});', s, re.S); data = json.loads(m.group(1)); data[key] = d
    open(p, 'w', encoding='utf-8').write(s[:m.start(1)] + json.dumps(data) + s[m.end(1):])
    print(key, 'bpm', d['bpm'], 'offset', d['offset'], 'dur', d['duration'])


if __name__ == '__main__':
    main()
