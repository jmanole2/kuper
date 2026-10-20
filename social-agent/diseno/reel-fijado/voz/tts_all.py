import json, os, torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
LINES = [
 (0.0, "Casi medianoche. No contestas, no publicas. Venta perdida."),
 (3.1, "Contestar a cualquier hora. Publicar cinco veces por semana."),
 (6.5, "No alcanzas con todo."),
 (8.3, "En Kuper armamos agentes de IA a tu medida."),
 (11.1, "¿No alcanzas a contestar WhatsApp?"),
 (13.2, "¿Hay cita el sábado a las once?"),
 (16.7, "Tu agente la reserva. En segundos."),
 (20.0, "Sin menús. Entiende como te escriben."),
 (23.1, "¿No tienes tiempo de publicar?"),
 (25.2, "Tu agente crea tus cinco posts, con tu marca."),
 (29.0, "Si quieres, los revisas antes."),
 (31.1, "Y se publican solos en Instagram, Facebook, LinkedIn y TikTok."),
 (34.7, "¿Otra tarea que repites cada día?"),
 (37.1, "Nos hablas de ella y armamos tu agente."),
 (39.6, "Tú no tocas nada técnico."),
 (43.0, "Comenta AGENTE y dinos qué quieres que haga."),
 (45.6, "Casi medianoche. Y ya está respondido."),
]
os.makedirs("voz", exist_ok=True)
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
torch.manual_seed(11)
for i, (at, txt) in enumerate(LINES):
    f = f"voz/{i:02d}.wav"
    if os.path.exists(f): continue
    w = m.generate(txt.replace("IA", "I A").replace("AGENTE", "agente").replace("TikTok", "Tik Tok"), language_id="es", audio_prompt_path="muestra.wav", exaggeration=0.45, cfg_weight=0.35)
    ta.save(f, w, m.sr); print(i, round(w.shape[-1] / m.sr, 2), flush=True)
json.dump(LINES, open("voz/lines.json", "w"), ensure_ascii=False)
