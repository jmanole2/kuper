# Mezcla la narración (cada línea en su segundo) con los efectos y la pone al video.
import json, subprocess, wave, numpy as np, sys
FF = "/home/user/novaplastica/social-agent/node_modules/ffmpeg-static/ffmpeg"
D = "/home/user/novaplastica/social-agent/diseno/reel-fijado/"
SR, DUR = 48000, 48.0
def load(path, extra=[]):
    raw = subprocess.run([FF, "-loglevel", "error", "-i", path, *extra, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768
L = json.load(open("voz/lines.json"))
voice = np.zeros(int(SR * (DUR + 2)))
for i, (at, txt) in enumerate(L):
    nxt = L[i + 1][0] if i + 1 < len(L) else DUR
    y = load(f"voz/{i:02d}.wav", ["-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=stop_periods=-1:stop_duration=0.22:stop_threshold=-40dB,highpass=f=70"])
    room = nxt - at - .12; dur = len(y) / SR
    if dur > room:
        tempo = min(1.2, dur / room); y = load(f"voz/{i:02d}.wav", ["-af", f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=stop_periods=-1:stop_duration=0.22:stop_threshold=-40dB,highpass=f=70,atempo={tempo:.3f}"])
        print(f"{i:02d}: {dur:.2f}s en {room:.2f}s → atempo {tempo:.2f}" + (" (sigue largo)" if len(y) / SR > room + .05 else ""))
    y = y / max(1e-6, np.abs(y).max()) * .8
    s = int((at + .05) * SR); voice[s:s + len(y)] += y[:len(voice) - s]
voice = voice[:int(SR * DUR)]
sfx = load(D + "sfx.wav")[:len(voice)]
# baja los efectos donde hay voz
env = np.convolve((np.abs(voice) > .02).astype(float), np.ones(int(.15 * SR)) / (.15 * SR), "same")
mix = voice + sfx * (0.55 - 0.42 * np.clip(env * 3, 0, 1))
mix = mix / np.abs(mix).max() * .9
with wave.open("mezcla.wav", "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
subprocess.run([FF, "-y", "-loglevel", "error", "-i", D + "reel-kuper-agentes.mp4", "-i", "mezcla.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
  "-af", "acompressor=threshold=-18dB:ratio=3:attack=5:release=120,loudnorm=I=-14:TP=-1.5:LRA=9", "-ac", "2", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", D + "reel-kuper-agentes-voz.mp4"], check=True)
print("ok")
