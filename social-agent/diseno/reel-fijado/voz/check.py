# Transcribe cada línea con Whisper y la compara con el guion.
import json, re, unicodedata
from faster_whisper import WhisperModel
L = json.load(open("voz/lines.json"))
m = WhisperModel("small", device="cpu", compute_type="int8")
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode())
for i, (at, txt) in enumerate(L):
    segs, _ = m.transcribe(f"voz/{i:02d}.wav", language="es", beam_size=5)
    got = " ".join(s.text for s in segs).strip()
    a, b = set(norm(txt).split()), set(norm(got).split())
    score = len(a & b) / max(1, len(a))
    print(f"{i:02d} {score:.2f} | {txt} | {got}", flush=True)
