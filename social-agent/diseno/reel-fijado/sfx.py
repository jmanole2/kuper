# Efectos de sonido del reel, sintetizados en código (sin derechos de terceros).
# Uso: python3 sfx.py salida.wav
import sys, wave, numpy as np
SR = 48000; DUR = 48.0
out = np.zeros(int(SR * DUR) + SR)
rng = np.random.default_rng(7)
t_ = lambda d: np.arange(int(SR * d)) / SR
def env(n, a=.005, r=.08):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / r)
def place(at, sig, gain=1.0, pan=0):
    i = int(at * SR); out[i:i + len(sig)] += sig[:len(out) - i] * gain
def lowpass(x, k):  # media móvil simple
    k = max(1, int(k)); return np.convolve(x, np.ones(k) / k, 'same')
def pop(f0=620, f1=980, d=.07):
    t = t_(d); f = np.linspace(f0, f1, len(t)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, .025)
def blip(f=880, d=.06):  # voz del personaje: "bip"
    t = t_(d); s = np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * t) * .5
    return lowpass(s, 6) * env(len(t), .003, .03)
def bipbup(up=True): return np.concatenate([blip(740 if up else 1100), np.zeros(int(.02 * SR)), blip(1100 if up else 740)])
def chime(fs=(1318.5, 1975.5), d=.9):
    t = t_(d); return sum(np.sin(2 * np.pi * f * t) * (1 / (i + 1)) for i, f in enumerate(fs)) * env(len(t), .003, .25) * .6
def whoosh(d=.45, bright=8):
    n = int(SR * d); x = rng.standard_normal(n); t = np.arange(n) / n
    e = np.sin(np.pi * t) ** 2; y = np.zeros(n); seg = n // 12
    for k in range(12):  # barrido de filtro
        a, b = k * seg, (k + 1) * seg; y[a:b] = lowpass(x[a:b], bright + 30 * abs(np.sin(np.pi * k / 12 - 1.2)))
    return y * e * .5
def thud(): t = t_(.25); return (np.sin(2 * np.pi * 85 * t) * env(len(t), .002, .07) + lowpass(rng.standard_normal(len(t)), 30) * env(len(t), .001, .02) * .4)
def boing(): t = t_(.32); f = 220 + 300 * (t / .32) ** .6; return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .005, .12) * .6
def tick(): return lowpass(rng.standard_normal(int(.012 * SR)), 3) * env(int(.012 * SR), .0005, .003)
def crumple(d=.6):
    n = int(SR * d); y = np.zeros(n)
    for _ in range(40):
        i = rng.integers(0, n - 2000); y[i:i + 1500] += lowpass(rng.standard_normal(1500), 2) * env(1500, .0005, .004) * rng.uniform(.3, 1)
    return y * .6
def heartbeat_ding(): return chime((1046.5, 1568), .5) * .7

# ---- línea de tiempo (segundos del video)
place(.15, heartbeat_ding(), .5); place(1.4, pop(500, 700), .35); place(2.6, pop(500, 700), .3)
for col in (0, 1):
    for i in range(5 if col else 4): place(3.6 + col * .3 + i * .42, tick(), .5)
place(6.6, whoosh(.6, 12), .7); place(7.4, thud(), .5)
place(8.2, boing(), .8); place(8.9, thud(), .7); place(9.6, bipbup(True), .45)
for d in (11.0, 23.0, 34.6): place(d + .3, whoosh(.7, 6), .55)
place(13.4, pop(), .45)
for k in range(10): place(14.3 + k * .22, tick(), .25)
place(16.6, pop(700, 1100), .45); place(17.2, bipbup(True), .4); place(17.5, chime(), .5); place(17.6, pop(), .35); place(17.8, whoosh(.5, 4), .3)
place(20.2, bipbup(False), .4); place(20.8, crumple(), .7); place(21.3, whoosh(.4, 10), .4)
for i in range(5): place(25.6 + i * .42, pop(520 + i * 80, 820 + i * 80), .45); place(26.0 + i * .42, tick(), .3)
place(29.9, tick(), .8); place(30.3, tick(), .8); place(30.35, pop(800, 1200, .05), .3)
for i in range(4): place(31.0 + i * .45, whoosh(.35, 3), .35); place(31.4 + i * .45, chime((1568, 2349), .5), .3)
for i in range(4): place(37.2 + i * .1, pop(400 + i * 60, 600 + i * 60, .05), .3)
place(38.2, chime((987.8, 1318.5, 1975.5), 1.0), .5); place(38.8, bipbup(True), .4)
for i in range(6): place(39.6 + i * .16, pop(600 + i * 50, 900 + i * 50, .05), .35)
place(41.4, bipbup(True), .4)
place(43.2, chime((659.3, 987.8, 1318.5), 1.2), .6); place(43.3, whoosh(.5, 5), .3)
place(45.4, boing(), .5); place(45.8, pop(700, 1100), .45); place(46.6, pop(), .45); place(46.9, chime(), .55); place(46.5, bipbup(True), .4)

out = out[:int(SR * DUR)]
out = out / max(1e-9, np.abs(out).max()) * .7
st = np.stack([out, out], 1)
with wave.open(sys.argv[1], 'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print('ok')
