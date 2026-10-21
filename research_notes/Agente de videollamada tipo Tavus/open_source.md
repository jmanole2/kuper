# Open-source / self-hosted real-time AI video-call avatar (free "Tavus clone"), as of Oct 2026

## Q1. Which talking-head models can actually run in real time: licenses, GPU, FPS and latency

### Takeaway
Only a few models are truly real-time (25+ FPS streaming) on one consumer GPU: **MuseTalk 1.5** (MIT, commercial use OK), **Wav2Lip** (fast, but non-commercial), **SoulX-FlashHead Lite** (Apache-2.0 repo, 2026), **Ditto** (Apache-2.0, TensorRT) and **LiteAvatar**, which reaches 30 FPS on CPU only (MIT). SadTalker, Hallo, EchoMimic, LatentSync, JoyVASA and Duix.Avatar are offline video generators, not live-call engines.

### Cited Findings
**MuseTalk (TMElyralab)**
- It is described as "real-time high quality" lip-sync, running at 30fps+ on an NVIDIA Tesla V100. The face region is 256×256, and the README suggests GFPGAN for higher resolution. — [MuseTalk GitHub](https://github.com/TMElyralab/MuseTalk)
- v1.5 was released 2025-03-28, with training code following on 2025-04-05. It adds perceptual, GAN and sync losses. — [MuseTalk GitHub](https://github.com/TMElyralab/MuseTalk)
- License: the code is MIT, and the weights are "available for any purpose, including commercial use". The test data is for non-commercial research only. Dependencies (Whisper, sd-vae-ft-mse, DWpose) have their own permissive licenses. — [MuseTalk GitHub](https://github.com/TMElyralab/MuseTalk); [CreativeAINews license review](https://www.creativeainews.com/articles/open-source-lip-sync-licenses-commercial-use-2026/)
- Measured FPS inside LiveTalking: 42 FPS on an RTX 3080Ti, 45 on a 3090 and 72 on a 4090. — [LiveTalking GitHub](https://github.com/lipku/LiveTalking)

**Wav2Lip**
- In LiveTalking, wav2lip256 runs at 60 FPS on an RTX 3060 and 120 FPS on a 3080Ti. — [LiveTalking GitHub](https://github.com/lipku/LiveTalking)
- License: the repo has no license file. The README says "any form of commercial use is strictly prohibited" because the weights were trained on LRS2. — [CreativeAINews](https://www.creativeainews.com/articles/open-source-lip-sync-licenses-commercial-use-2026/); [Wav2Lip README mirror](https://huggingface.co/camenduru/Wav2Lip/resolve/main/README.md)

**Ditto (antgroup/ditto-talkinghead)**
- It is billed as "Controllable Realtime Talking Head Synthesis" and accepted at ACM MM 2025. It ships TensorRT engines prebuilt for Ampere+ GPUs, plus ONNX and PyTorch versions, and has an online streaming pipeline (`stream_pipeline_online.py`). It was tested on an A100. The repo is Apache-2.0, and no separate weights license is stated. Dates: code released 2025-01-10, PyTorch model 2025-07-11, training code 2025-11-12. The README gives no FPS figure. — [Ditto GitHub](https://github.com/antgroup/ditto-talkinghead)

**SoulX-FlashHead (Soul-AILab, Feb 2026)**
- Lite reaches 96 FPS on one RTX 4090, or 3 concurrent streams at 25+ FPS. Pro reaches 10.8 FPS on one 4090, and 25+ FPS only on two RTX 5090s with SageAttention. The repo is Apache-2.0, and weights were released 2026-02-12. It has a streaming Gradio app and an HF Spaces demo. — [SoulX-FlashHead GitHub](https://github.com/Soul-AILab/SoulX-FlashHead)
- A press report says Lite needs about 6.4 GB VRAM, and that Pro reaches 16.8 FPS on one RTX 5090. — [ITBear (Chinese press)](https://www.itbear.com.cn/html/2026-02/1162378.html)
- It is already integrated as an avatar option in OpenAvatarChat v0.6.0 (April 2026). — [OpenAvatarChat GitHub](https://github.com/HumanAIGC-Engineering/OpenAvatarChat)

**LiteAvatar (HumanAIGC)**
- It is a realtime 2D chat avatar that "can run in 30fps on only CPU devices without GPU acceleration", and can also be deployed on mobile. The pipeline is Paraformer ASR features, then mouth-parameter prediction, then a 2D face generator. License: MIT. Ready-made avatars come from the LiteAvatarGallery on ModelScope. The README does not explain how to create a new avatar from your own face. — [lite-avatar GitHub](https://github.com/HumanAIGC/lite-avatar)

**LivePortrait (KwaiVGI)**
- It is driven by video, image or motion templates, not audio. Audio-driven use comes from community projects such as Ditto, and real-time use from forks such as FasterLivePortrait (TensorRT). Apple Silicon is about 20× slower than an RTX 4090. The last listed update is 2025-06-01. — [LivePortrait GitHub](https://github.com/KwaiVGI/LivePortrait)

**SadTalker**
- Apache-2.0 "except for the third-party components" listed, so commercial use depends on those components. — [CreativeAINews](https://www.creativeainews.com/articles/open-source-lip-sync-licenses-commercial-use-2026/)

**LatentSync**
- Reported as Apache-2.0 with no carve-outs, so commercial use is permitted. This comes from a single secondary source. — [CreativeAINews](https://www.creativeainews.com/articles/open-source-lip-sync-licenses-commercial-use-2026/)

**EchoMimic**
- Apache-2.0. Even after a 10× speed-up, it takes about 50 s per 240 frames on a V100, which is far from real time. — [EchoMimic mirror](https://toscode.mulanos.cn/dlj12/EchoMimic)

**JoyVASA (jdh-algo)**
- A diffusion-based, audio-driven talking-head model (it also animates animal faces). An aggregator lists it as MIT. — [dev.co aggregator](https://dev.co/ai/frameworks/joyvasa)

**LongCat-Video-Avatar 1.5**
- MIT, per its HF model card. — [CreativeAINews](https://www.creativeainews.com/articles/open-source-lip-sync-licenses-commercial-use-2026/)

**Duix.Avatar (duixcom, the open-source HeyGem successor)**
- The open-source toolkit is **offline, not real-time**. For interactive real-time avatars, the README points users to duix.com.
- Requirements: an NVIDIA GPU (RTX 4070 recommended), 32 GB RAM, 100 GB+ of disk, and a Docker image of about 70 GB.
- License: "global free commercial use", but companies with more than 100k users or $10M+ in revenue must sign a commercial agreement.
- [Duix-Avatar GitHub](https://github.com/duixcom/Duix-Avatar)

**Newer research models (2025–2026)**
- These include StreamAvatar (CVPR 2026, arXiv 2512.22065), OmniMate (arXiv 2607.23023, built on LTX2.3, uses proprietary data), Omni-LiveAvatar (2608.13602), Avatar-Forever (2608.12107), Wan-Streamer v0.1 (2606.25041) and Livatar-1 (2507.18649). — [search results / arXiv](https://arxiv.org/abs/2512.22065)
- AVTR-1 (arXiv 2609.22913, submitted 2026-09-19) is an "open stack for real-time interactive avatars". It uses a 153M-parameter autoregressive flow-matching motion generator conditioned on audio from both participants, so it also produces listening behavior. It has a streaming audio encoder, handles interruptions, and is driven by an external voice agent. Weights, renderer and serving backend are released "under component-specific licenses", which the paper does not specify. — [arXiv 2609.22913](https://arxiv.org/abs/2609.22913)

### Inferences
- **Best commercial-safe GPU choice:** MuseTalk 1.5 (MIT code and weights). It runs in real time on an RTX 3080Ti-class GPU or better, and is the most battle-tested since both LiveTalking and OpenAvatarChat integrate it.
- **For better quality in 2026:** SoulX-FlashHead Lite (Apache-2.0, about 6 GB VRAM, 96 FPS on a 4090) looks like the strongest new option. Confirm that the weights license matches the repo license.
- **Wav2Lip** is the cheapest on GPU (an RTX 3060 is enough), but it is non-commercial only.
- **For the cheapest GPU-free prototype:** LiteAvatar (CPU, 30 FPS, MIT) is the standout.
- Hallo, EchoMimic, LatentSync, SadTalker and JoyVASA are diffusion or offline pipelines. They suit pre-rendered clips, not a live call.

### Gaps
- I could not verify Hallo / Hallo2 / Hallo3 licenses or any real-time figures for them.
- LivePortrait's license text was not shown on the page. From memory, the code is MIT but its InsightFace face-detection models are non-commercial; this is unverified here.
- I found no published FPS or latency numbers for Ditto, and no explicit weights license.
- The SoulX-FlashHead weights license on Hugging Face was not checked separately from the Apache-2.0 repo license.
- For AVTR-1, I found no GitHub link and no concrete license or FPS.
- JoyVASA's and Linly-Talker's MIT status comes from aggregators only.

## Q2. Orchestration frameworks: LiveKit Agents and Pipecat, and plugging in a custom avatar

### Takeaway
Both frameworks are open source, but their built-in avatar plugins are all paid SaaS (Tavus, Simli, Anam, HeyGen/LiveAvatar, bitHuman, etc.). LiveKit does document a supported path for a **self-hosted custom avatar worker** (`AvatarRunner` + `DataStreamAudioOutput`), which makes it the cleanest way to wrap MuseTalk, FlashHead or Ditto. I found no maintained open-source self-hosted avatar service for Pipecat.

### Cited Findings
- The LiveKit Agents avatar plugins are Anam, Avatario, AvatarTalk, Beyond Presence, bitHuman, D-ID, Keyframe, LemonSlice, LiveAvatar, Protoface, Runway, Simli, Spatius, Synthesia, Tavus and TruGen. — [LiveKit docs: avatars](https://docs.livekit.io/agents/models/avatar/)
- **LiveKit custom avatar (Python):**
  - The avatar worker is a separate participant that publishes synchronized audio and video on behalf of the agent (the `lk.publish_on_behalf` attribute).
  - The agent sends its TTS audio with `session.output.audio = DataStreamAudioOutput(ctx.room, destination_identity=AVATAR_IDENTITY, wait_playback_start=True)`.
  - The worker is built with the `AvatarRunner` helper, which sends the `lk.playback_started` RPC automatically. Custom workers call `notify_playback_started()` on `DataStreamAudioReceiver` instead.
  - [LiveKit docs: avatars](https://docs.livekit.io/agents/models/avatar/)
- **Pipecat video services:**
  - Tavus (`TavusVideoService` / `TavusTransport`), HeyGen LiveAvatar, Anam (separate package), and the community `pipecat-protoface`, which needs an API key. — [Pipecat Protoface docs](https://docs.pipecat.ai/api-reference/server/services/video/protoface); [pipecat-anam](https://github.com/anam-org/pipecat-anam); [LiveAvatar Pipecat plugin](https://docs.liveavatar.com/docs/lite-mode/plugins/pipecat)
  - The AWS sample self-hosts the Pipecat orchestration, but the video still comes from Tavus. — [aws-samples voice-ai-tavus-avatar-demo](https://github.com/aws-samples/sample-voice-ai-tavus-avatar-demo)

### Inferences
- With LiveKit (self-hosted server, Apache-2.0), write a Python avatar worker:
  1. Receive the audio stream.
  2. Feed it in chunks to MuseTalk or FlashHead.
  3. Push the frames as `rtc.VideoFrame`s alongside the audio, using AvatarRunner's AV-sync.
- With Pipecat, you would write a custom `FrameProcessor` that consumes `TTSAudioRawFrame` and emits `OutputImageRawFrame` over the SmallWebRTC or Daily transport. This is my inference from Pipecat's frame architecture; I found no ready example.

### Gaps
- The LiveKit example folder (`livekit/agents/examples/avatar_agents`) returned 404, so I could not confirm the current path of the "audio_wave" local avatar sample.
- I did not verify the exact signature of the `VideoGenerator` interface.

## Q3. Complete open-source "voice agent + lip-synced avatar over WebRTC" projects

### Takeaway
**OpenAvatarChat** (Apache-2.0, v0.6.0 April 2026, ~3.8k★) is the most complete and actively maintained. **LiveTalking** (Apache-2.0) is the most performance-oriented streaming engine. **VideoChat** (MIT) and **Linly-Talker / Linly-Talker-Stream** are viable but less mature.

### Cited Findings
**OpenAvatarChat (HumanAIGC-Engineering)**
- A modular pipeline: SenseVoice ASR, Silero VAD, and an LLM/TTS via cloud APIs (Bailian/CosyVoice) or Qwen-Omni end to end.
- Avatar options: LiteAvatar, LAM, MuseTalk and SoulX-FlashHead.
- Transport is WebRTC via gradio-webrtc. Average response time is about 2.2 s.
- v0.6.0 (April 2026) split the frontend and backend, added manual and duplex interruption for all avatars, and added FlashHead. v0.5.1 (2025-08-19) added multi-session LiteAvatar.
- An Agent preset (beta) integrates OpenClaw. Apache-2.0, about 3.8k stars.
- [OpenAvatarChat GitHub](https://github.com/HumanAIGC-Engineering/OpenAvatarChat)

**LiveTalking (lipku, formerly metahuman-stream)**
- Models: ernerf, musetalk, wav2lip and Ultralight-Digital-Human.
- Output: WebRTC, RTMP and virtual camera.
- Features: voice cloning, interruption, EdgeTTS/CosyVoice, and LLM chat mode.
- Real time requires 25+ FPS. It recommends an RTX 3060+ for wav2lip and an RTX 3080Ti+ for musetalk. Tested on Ubuntu 22.04, PyTorch 2.9.1 and CUDA 12.8.
- Apache-2.0, but the README asks that published videos carry the LiveTalking watermark and logo.
- [LiveTalking GitHub](https://github.com/lipku/LiveTalking)

**VideoChat (Henry-23)**
- Two pipelines: a cascade (FunASR → Qwen → GPT-SoVITS/CosyVoice/edge-tts → MuseTalk) and an end to end variant using GLM-4-Voice.
- First-packet latency is about 3 s for the cascade and about 7 s end to end, on an A100. VRAM is about 8 GB for the cascade and about 20 GB end to end.
- MIT, about 1.3k stars. Known issues include stuttering video.
- [VideoChat GitHub](https://github.com/Henry-23/VideoChat)

**Linly-Talker (Kedreamix)**
- A Gradio system combining ASR, TTS, voice cloning, an LLM and multiple talking-head backends. The Linly-Talker-Stream variant adds WebRTC low-latency streaming. — [Linly-Talker-Stream README](https://raw.githubusercontent.com/Kedreamix/Linly-Talker-Stream/main/README.md); [Linly-Talker fork](https://github.com/tenzo444/Linly-Talker)

### Inferences
- **Fastest path to a working prototype:** OpenAvatarChat with the LiteAvatar (CPU) or MuseTalk (GPU) preset. Swap its cloud LLM/TTS for an OpenAI-compatible endpoint such as Groq or Gemini, or for local Ollama with edge-tts.
- LiveTalking is the better choice for a single-avatar, broadcast-style stream on a modest GPU.
- Expected end to end latency is about 2–3 s, versus sub-second for Tavus's commercial claims, so expect a noticeably slower feel.

### Gaps
- I found no independent benchmarks comparing these projects.
- The exact LiveTalking release cadence and dates are not shown.
- Linly-Talker's license is unverified.

## Q4. Free compute for a prototype

### Takeaway
Free GPU notebooks (Colab, Kaggle) can run MuseTalk or Wav2Lip at near real time on a T4, but they lack stable inbound networking for WebRTC; you need tunnels or TURN, and sessions end after 12 h. HF ZeroGPU is unusable for continuous streaming. Modal's $30/month credit is the most realistic "free" real-time GPU host.

### Cited Findings
- **HF ZeroGPU:** the free quota is about 3.5–5 GPU-minutes per day (sources conflict). There is a 60 s default budget per call, and an April 2026 report of a cap of about 3 runs per day for free users. A free account can host at most 2 ZeroGPU Spaces. — [HF forum](https://discuss.huggingface.co/t/what-is-the-free-zerogpu-quota-for-1-space/178610); [HF forum: free account quota](https://discuss.huggingface.co/t/free-account-zerogpu-quota-issue/175180); [HF ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu.md)
- **Modal Starter (free):** $30 of compute credit per month, billed per second. A T4 costs about $0.59/h. — [costbench Modal free plan](https://costbench.com/software/ai-gpu-cloud/modal/free-plan/)
- **Kaggle:** about 30 GPU-hours per week, though this figure comes from user reports, not an official statement. Sessions are capped at 12 h. **Colab free:** about 15–30 T4-hours per week (unofficial), 12 h sessions and no SSH. — [gpuperhour 2026](https://gpuperhour.com/blog/free-cloud-gpus-and-credits); [gmicloud](https://www.gmicloud.ai/en/blog/best-free-gpu-cloud-options-for-ai-startups-and-researchers)
- The SoulX-FlashHead team hosts a streaming demo on HF Spaces, but it is a demo, not a call service. — [SoulX-FlashHead GitHub](https://github.com/Soul-AILab/SoulX-FlashHead)

### Inferences
- A T4 is roughly V100-class or below, so MuseTalk probably runs around 20–30 FPS there. That is borderline; Wav2Lip or LiteAvatar is safer. This is unmeasured.
- At about $0.59/h on a T4, $30 buys about 50 GPU-hours per month on Modal, which is enough for a demo.
- Alternatively, LiteAvatar on a free CPU VM avoids GPUs entirely.

### Gaps
- I found no source confirming WebRTC/UDP works from Colab or Kaggle. It likely needs a TURN server or a cloudflared/ngrok tunnel (TCP), which this research did not verify.
- I found no measured MuseTalk FPS on a T4.

## Q5. Lightweight no-GPU alternative: browser 2D/3D avatars

### Takeaway
**TalkingHead.js** (MIT, v1.7, Three.js) plus its **HeadAudio** (audio-driven visemes in-browser) or **HeadTTS** (Kokoro in WebGPU) add-ons gives a zero-GPU-server avatar. Paired with a free LLM API (Gemini or Groq) and browser STT, this is a $0 prototype, at the cost of a stylized 3D look instead of a photoreal face.

### Cited Findings
- **TalkingHead (met4citizen):** a browser JS class for real-time lip-sync of full-body 3D GLB avatars, MIT, about 1.6k stars, CDN version 1.7 with Three.js 0.180.
  - Avatars need a Mixamo rig plus ARKit and Oculus viseme blendshapes. Sources include Ready Player Me, Avaturn, MPFB, AvatarSDK, VRoid (via Blender conversion) and RocketBox.
  - Asset licenses differ: the RPM sample is CC BY-NC 4.0, and the Avaturn avatars are non-commercial.
  - [TalkingHead GitHub](https://github.com/met4citizen/TalkingHead)
- **TalkingHead lip-sync and TTS options:**
  - Lip-sync uses Oculus visemes and word timestamps. Built-in languages are EN, DE, FR, PT-BR, FI and LT; Azure visemes extend this to 100+ languages.
  - TTS: Google TTS (default), ElevenLabs WebSocket, Azure, and HeadTTS (free Kokoro voices running in-browser via WebGPU).
  - The **browser Web Speech API is not suitable for TTS** because it gives no word timestamps.
  - HeadAudio is an audio-worklet that detects visemes in real time from any audio, with no timestamps needed.
  - [TalkingHead GitHub](https://github.com/met4citizen/TalkingHead)
- Adafruit (May 2026) highlighted TalkingHead as an open-source real-time lip-syncing 3D avatar. — [Adafruit blog](https://blog.adafruit.com/2026/05/13/open-source-3d-avatars-that-can-speak-and-lip-sync-in-real-time/)

### Inferences
- **Suggested $0 stack:**
  1. Browser `SpeechRecognition` for STT (Chrome) or Whisper WASM.
  2. The Gemini or Groq free-tier API for the LLM, called through a tiny proxy to hide the key.
  3. HeadTTS (Kokoro) or Google TTS for speech.
  4. TalkingHead plus HeadAudio for lip-sync, using a commercially licensed or self-made GLB/VRoid avatar. Do not use the RPM or Avaturn samples for commercial work.
- No WebRTC server is needed for one-on-one use, since everything runs client-side.
- This is a much better fit for Spanish than TalkingHead's built-in lip-sync languages, which do not include Spanish. Use HeadAudio (language-agnostic) or Azure visemes.
- **Photoreal middle ground:** LiteAvatar on CPU, through OpenAvatarChat.

### Gaps
- Live2D or VRM-native options (e.g. three-vrm with lip-sync) were not researched in depth.
- Ready Player Me's current service status in 2026 was not verified; the TalkingHead page does not mention a shutdown.
- Current Gemini and Groq free-tier limits were not checked in this pass.
- Live2D licensing (its SDK is proprietary, free for small businesses) is not covered by these sources.
