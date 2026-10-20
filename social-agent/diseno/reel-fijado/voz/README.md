# Narración con la voz de Kuper (clonada con permiso)

Modelo: Chatterbox Multilingual (Resemble AI, licencia MIT, uso comercial permitido), en CPU.
La muestra de voz es del dueño de la cuenta y se usa con su permiso; no se guarda en el repo.
El audio generado lleva la marca de agua implícita de Chatterbox (contenido hecho con IA).

1. `tts_all.py`: genera cada línea de `lines.json` (texto + segundo en que entra) con `muestra.wav`.
2. `check.py`: transcribe cada línea con Whisper y la compara con el guion; las que fallan se regeneran con otra semilla.
3. `mix.py`: recorta pausas largas, ajusta la velocidad si una línea no cabe en su escena (máx. x1.2),
   la pone en su segundo, baja los efectos (`../sfx.wav`) mientras habla y normaliza a -14 LUFS.

Ajustes que funcionaron: exaggeration 0.45-0.5, cfg_weight 0.5 (con 0.35 sale demasiado lenta).
"IA" se escribe "ía" para que la pronuncie.
