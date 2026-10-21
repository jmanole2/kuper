# Tavus (tavus.io) and its Conversational Video Interface (CVI): late 2026

All pages were read on 2026-10-21 unless noted otherwise. **Terminology change:** Tavus renamed **Persona → PAL** and **Replica → Face**. The new API uses `pal_id`/`face_id` and `/v2/pals`. The legacy names (`/v2/personas`, `/v2/replicas`, `persona_id`, `replica_id`, `default_replica_id`) still work as aliases. Older tutorials, and the Pipecat docs, still use the old names.

## 1. Products and how a CVI conversation works technically

### Takeaway
CVI is a real-time WebRTC video-agent stack. A **PAL** holds the behaviour and pipeline config: system prompt and the perception, STT, LLM, TTS and turn-taking layers. A **Face** is the avatar and default voice, rendered live by Phoenix. Creating a **conversation** returns a `conversation_url` for a Daily-hosted room, and the agent can also join Zoom, Google Meet or Teams. You can bring your own LLM through any OpenAI-compatible streaming `/chat/completions` endpoint. Tool calling uses a tools registry, and calls are delivered either to your frontend as app-message events or to your server as HTTPS calls.

### Cited Findings
- **Rename:** Persona is now PAL and replica is now Face, and the legacy names still work on existing endpoints and fields. A PAL covers behaviour, knowledge and pipeline config. A Face covers appearance and default voice, and is either a stock face or a trained face. — [Tavus docs: What is a PAL](https://docs.tavus.io/sections/conversational-video-interface/pal/what-is-a-pal); [PAL overview](https://docs.tavus.io/sections/conversational-video-interface/pal/overview)
- **CVI definition:** CVI is a framework for live video conversations with an AI agent that sees, hears and responds. Media runs over WebRTC, powered by Daily. — [CVI overview](https://docs.tavus.io/sections/conversational-video-interface/overview-cvi)
- **Pipeline, in order:**
  1. Perception (**Raven**): user expressions, gaze, background and screen share.
  2. Conversational flow (**Sparrow**): turn-taking and interruptibility.
  3. STT.
  4. LLM: Tavus-hosted or your own.
  5. TTS: Cartesia is the default on that page; ElevenLabs and Azure are also supported.
  6. Real-time face rendering (**Phoenix**).

  The overview page gives no millisecond latency figures. — [CVI overview](https://docs.tavus.io/sections/conversational-video-interface/overview-cvi)
- **Current model and engine options in the Create PAL API reference:**
  - `perception_model`: `raven-2`, `raven-1` (default), `raven-0` (legacy) or `off`.
  - `stt_engine`: `tavus-auto` (default), `tavus-soniox`, `tavus-whisper` or `tavus-deepgram-medical`.
  - `tts_engine`: `tavus-auto` (default), `cartesia`, `elevenlabs` or `azure`.
  - `turn_detection_model`: `sparrow-2` (default); `sparrow-1` is deprecated.
  - Flow controls: `turn_taking_patience` and `pal_interruptibility` (low, medium or high), plus `wake_phrase`, `sleep_phrase` and `idle_engagement`.
  - Other layers: `conferencing` and `mcp`.

  — [Create PAL API](https://docs.tavus.io/api-reference/pals/create-pal)
- **`pipeline_mode`:**
  - `full` is the default end-to-end mode.
  - `echo` turns off most of the pipeline. You send audio through Echo events, and the Face lip-syncs and speaks it. Echo mode is what LiveKit and Pipecat use.

  — [Create PAL API](https://docs.tavus.io/api-reference/pals/create-pal)
- **Tavus-hosted LLMs (Oct 2026):**
  - `tavus-gemma-4` is recommended: low latency and strong tool use.
  - `tavus-gpt-5.6-sol` has the strongest tool adherence but higher latency.
  - `tavus-gpt-5.6-terra` is near Sol quality with lower latency.
  - Deprecated: `tavus-gpt-oss`, `tavus-glm-4.7`, `tavus-claude-haiku-4.5`, `tavus-gpt-5.2`, `tavus-gemini-3-flash` and `tavus-gpt-4.1`.
  - `tavus-gemini-2.5-flash` retires 2026-10-20 and reroutes to terra.

  — [LLM layer docs](https://docs.tavus.io/sections/conversational-video-interface/pal/llm)
- **Bring your own LLM:** under `layers.llm`, set `model`, `base_url` (without route extensions) and `api_key`. The endpoint must be OpenAI-compatible `/chat/completions` with SSE streaming. Optional fields are `headers`, `extra_body` and `default_query`. `speculative_inference` (default `true`) starts the LLM before the user finishes speaking. — [LLM layer docs](https://docs.tavus.io/sections/conversational-video-interface/pal/llm)
- **Tool calling:**
  - **Setup:** create a tool at `/v2/tools` with `name`, `description`, `parameters` (JSON Schema), `origin` and `delivery`. Attach it with `/v2/pals/{pal_id}/tools`.
  - **`origin`:** `llm` (user speech), `vision` or `audio` (Raven perception), or `screen` (Raven-2 only). Post-call actions use `trigger_type: "post_call"`.
  - **Delivery:** the default is an app message, a `conversation.tool_call` event that your frontend handles. The alternative is an API call, where Tavus sends an HTTPS request to your endpoint.
  - **Built-in tool:** `end_call`.
  - **Legacy:** inline `layers.llm.tools` is deprecated for new work.

  — [Tools docs](https://docs.tavus.io/sections/conversational-video-interface/pal/tools)
- **Faces:**
  - More than 100 stock Faces, plus a curated "Pro Faces" set.
  - Custom Faces can be trained from video (the voice is cloned from the audio) or from a photo (you attach a voice separately).
  - Phoenix-4.5 gives a zero-shot preview in about 1 minute from a photo or a few minutes from video. The preview is watermarked, and tuning finishes in the background.
  - Phoenix-4 is for full-body Faces.
  - The Faces page says custom Faces need the "Starter, Growth, or Enterprise" plan. This wording may be stale relative to the six-tier pricing; see section 2.

  — [Faces overview](https://docs.tavus.io/sections/faces/overview)
- **Phoenix-4.5 training video requirements:**
  - Content: one continuous shot of about 60 s, made of about 30 s talking and then about 30 s still, with lips neutral and closed.
  - Technical: at least 1080p and 25 FPS; `.webm` or `.mp4` (H.264 or HEVC video, AAC audio); at most 750 MB; at a publicly accessible URL.
  - Framing: chest-up, face filling at least 25% of the frame, camera at least 3 ft away, recorded with a desktop app rather than a browser.
  - Subjects: no animals or mascots.
  - Consent: there is no separate consent statement on the page. You must have rights to the likeness under the ToS and Acceptable Use Policy.

  — [Phoenix-4.5 video requirements](https://docs.tavus.io/sections/faces/phoenix-45-video-requirements)
- **Phoenix-4 requirements** are similar: at least 25 FPS, 1080p, at most 750 MB, webm or mp4. — [Phoenix-4 video requirements](https://docs.tavus.io/sections/faces/phoenix-4-video-requirements)
- **Recent changelog (2026):**
  - 15 Oct: Face Studio for Phoenix-4.5 faces in PAL Maker; GPT Live 1.5 speech-to-speech via Pipecat or LiveKit; official ChatGPT plugin built on the Tavus MCP server; faster `audio_only` mode.
  - 13 Oct: Sparrow-2 becomes the default.
  - 8 Oct: Agora support for WebRTC.
  - 7 Oct: Phoenix-4.5 quality upgrades.
  - 18 Sep: MCP connectors (Gmail, Calendar, Slack, Linear) and Dynamic Greeting.
  - 16 Sep: Memory Stores.
  - 12 Sep: Microsoft Teams joins.
  - 2 Sep: Phoenix-4.5 released.
  - 28 Aug: Publish PAL endpoint removed; API edits now apply live.
  - 7 Aug: `tavus-gemma-4` becomes the default LLM.
  - 31 Jul: Zoom joins via a calendar invite to `@tavusinvite.com`.
  - 19 Jun: Google Meet joins.
  - 12 Feb: the persona `context` field is deprecated in favour of `system_prompt`.

  — [Tavus changelog](https://docs.tavus.io/sections/changelog/changelog.md)
- **PALs (consumer):** consumer plans exist: Free with 15 min of calls and unlimited messaging, Plus at $20/mo for 150 min, and Max at $50/mo for 500 min. — [Tavus pricing](https://www.tavus.io/pricing)

### Inferences
- For an agent that joins a video call, the shortest path is: create a PAL (system prompt plus a Tavus or BYO LLM), then `POST /v2/conversations`. Either embed the `conversation_url`, or pass `meeting_url` so the agent joins Zoom, Meet or Teams.
- To keep full control of STT, LLM and TTS (for example a Spanish pipeline or a custom agent framework), use echo mode through LiveKit or Pipecat. In that setup Tavus only renders the Face.

### Gaps
- No official end-to-end latency figure was found in the docs read. Older Tavus marketing claims of about 600 ms or less were not re-verified.
- The video-generation API (asynchronous, non-real-time talking-head videos) was not researched in detail. It appears only as "video generation minutes" on the pricing page.
- The exact create-Face endpoint and photo-training requirements were not captured. The docs point to the Video to Face and Image to Face quickstarts.

## 2. Pricing: free plan, free minutes, per-minute rates, concurrency, stock replicas

### Takeaway
There is a free developer plan with **20 CVI minutes per month**, **1 concurrent session**, conversations **capped at 5 minutes**, stock Faces only, and a watermark. Overage cannot be bought on Free or on the $22 Starter plan, so their minutes are a hard cap. Pay-as-you-go overage starts on Builder ($59/mo) at $0.35/min. **Caution:** the tavus.io/pricing page currently contains both the new six-tier table and remnants of an older four-tier table, so the figures conflict. The six-tier figures are corroborated by third-party trackers from June to August 2026.

### Cited Findings
- **Current six-tier developer pricing** (tavus.io/pricing, seen 2026-10-21):

  | Plan | Price | CVI min/mo | CVI overage | Concurrent | Max call | Custom face slots | Stock faces | Video gen |
  |---|---|---|---|---|---|---|---|---|
  | Free | $0 | 20 | none | 1 | 5 min | none | 10 | not listed |
  | Starter | $22/mo | 60 | none | 1 | 10 min | 1 | 10 | 5 min ($1/min overage) |
  | Builder | $59/mo | 175 | $0.35/min | 3 | 15 min | 3 | 25 | 15 min ($0.90/min) |
  | Growth | $397/mo | 1,300 | $0.31/min | 10 | 60 min | 7 | 75+ | 50 min ($0.80/min) |
  | Business | $975/mo | 4,000 | $0.26/min | 15 | 60 min | 15 | 75+ | 250 min |
  | Enterprise | custom | custom | custom | custom | custom | unlimited | 75+ | custom |

  — [Tavus pricing](https://www.tavus.io/pricing)
- **What Free includes:** 20 free CVI minutes, white-labelled APIs and a no-code platform, stock faces, 42+ languages, and docs and community support. Starter is the first tier without a watermark. — [Tavus pricing](https://www.tavus.io/pricing)
- **Restructure timing:** in June 2026 the developer plans went from 4 to 6 tiers. A new $22 Starter was added, the old $59 Starter became Builder, and Business at $975 was added. Free and Starter have no pay-as-you-go rate, so their included minutes are a hard cap. A "50% off first month" promo on Builder appeared briefly in July 2026 and was removed. — [PricingSaaS diff, week 27 2026](https://pricingsaas.com/companies/tavus/diffs/2026W27); [UsagePricing Tavus blueprint](https://usagepricing.com/blueprint/tavus); [UsagePricing 2026-07-21 price change](https://usagepricing.com/blueprint/activity/tavus-2026-07-21-price-change)
- **Older four-tier figures still on the same page, likely outdated:**
  - Free ("Basic"): 25 CVI min, 25 stock replicas, 5 min video generation, 1 stream.
  - Starter: $59/mo, 100 CVI min, $0.37/min overage, 3 custom replica trainings at $65 each, up to 3 streams.
  - Growth: $397/mo, 1,250 min, 7 trainings at $40 each, up to 10 streams.
  - Other: recordings at $0.03/min; overage billed in 6-second increments with a **30-second minimum charge per conversation**.
  - The concurrency table on the same page is internally inconsistent: it shows 1, 3, 15 and custom.

  — [Tavus pricing](https://www.tavus.io/pricing)
- **Concurrency limit errors:** exceeding the concurrent-conversation limit returns HTTP 400 with a `message` field. — [Create Conversation API](https://docs.tavus.io/api-reference/conversations/create-conversation)
- **Consumer PAL plans:** Free (15 min), Plus ($20/mo, 150 min) and Max ($50/mo, 500 min) still show on the page. One tracker says Tavus stopped publishing these prices in July 2026. — [Tavus pricing](https://www.tavus.io/pricing); [UsagePricing blueprint](https://usagepricing.com/blueprint/tavus)

### Inferences
- **Free tier as a prototype:** it supports 4 test calls of 5 minutes each per month with a stock face, a watermark and a single session. It is not viable for production.
- **Cheapest production option:** Builder at $59/mo, which gives 175 min, then $0.35/min, 3 concurrent sessions and 15-minute calls.
- **Effective cost:** about $0.26–0.37 per minute of avatar video, plus your own LLM, STT and TTS costs if you use echo mode or BYO components.
- **Billing rules may be stale:** the 6-second billing increment and 30 s minimum come from the old pricing block and may still apply.

### Gaps
- It is unclear whether a credit card is required to sign up for Free. The page does not say.
- It is unclear whether the 6-second rounding and 30 s minimum still apply under the six-tier plans.
- Custom-face training fees under the six-tier plans could not be confirmed. "Custom face slots" replaced the per-training fees ($65/$40), and only the old table lists those fees.
- It is unclear whether minutes used through LiveKit or Pipecat echo mode are billed at the same CVI rate. This is presumed but not confirmed.

## 3. Integration options: LiveKit, Pipecat, web embedding, Zoom/Meet/Teams

### Takeaway
There are four ways to integrate:
- **LiveKit Agents:** official plugin, `tavus.AvatarSession`.
- **Pipecat:** `TavusVideoService`.
- **Web embedding:** an iframe of `conversation_url`, Daily JS/React, or the `@tavus/cvi-ui` component library.
- **Third-party meetings:** native joins into Google Meet (June 2026), Zoom (July 2026) and Microsoft Teams (Sept 2026), either through `meeting_url` or a calendar invite.

### Cited Findings
- **LiveKit Agents plugin:**
  - Install: `uv add "livekit-agents[tavus]~=1.8"` (Python) or `pnpm add @livekit/agents-plugin-tavus` (Node).
  - Environment: `TAVUS_API_KEY`, plus optional `TAVUS_FACE_ID` and `TAVUS_PAL_ID`.
  - Code: call `tavus.AvatarSession(face_id=..., pal_id=...)`, then `await avatar.start(session, room=ctx.room)` before `session.start()`.
  - The PAL **must use `pipeline_mode: "echo"` and a `livekit` transport layer**.
  - The default face is the stock "Lucy - Home" on phoenix-4.5, as of livekit-agents 1.8.1 and @livekit/agents 1.9.0; earlier versions used "Luna" on phoenix-3.

  — [LiveKit Tavus plugin docs](https://docs.livekit.io/agents/models/avatar/plugins/tavus/)
- **Pipecat:**
  - Install: `uv add "pipecat-ai[tavus]"`, then use `TavusVideoService(api_key, replica_id, session=aiohttp.ClientSession())`.
  - `persona_id` defaults to `"pipecat0"`, which means Tavus uses the Pipecat bot's TTS audio through `conversation.echo`.
  - It takes TTS audio as input and outputs a lip-synced video. With DailyTransport, two rooms are created: avatar with bot, and bot with user.
  - The Pipecat docs still use the legacy `replica_id` and `persona_id` names.

  — [Pipecat Tavus docs](https://docs.pipecat.ai/server/services/video/tavus)
- **Other channels:** on 2026-10-05 Tavus lowered audio-to-frame latency in the Pipecat and LiveKit pipelines. On 2026-10-15 it added GPT Live 1.5 speech-to-speech support through Pipecat or LiveKit, and on 2026-10-08 Agora WebRTC support. — [Changelog](https://docs.tavus.io/sections/changelog/changelog.md)
- **Web embedding:**
  - **iframe:** the fastest no-code option. Embed `conversation_url` in an iframe with `allow="camera; microphone; display-capture"` (official docs add fullscreen).
  - **Daily JS/React:** for full ownership of the call object.
  - **`@tavus/cvi-ui`:** a CLI that copies React components into your project (`CVIProvider`, `Conversation`) and installs `@daily-co/daily-react`, `@daily-co/daily-js` and `jotai`. Its server helpers keep `TAVUS_API_KEY` off the client.

  — [Tavus embedding docs](https://docs.tavus.io/sections/integrations/embedding-cvi); [Component library](https://docs.tavus.io/sections/conversational-video-interface/component-library)
- **Private rooms:** `require_auth: true` creates a private room and returns a `meeting_token`. Append it as `?t=TOKEN` or pass it to Daily `join()`. — [Create Conversation API](https://docs.tavus.io/api-reference/conversations/create-conversation)
- **Meeting joins:** `meeting_url` accepts a Google Meet, Zoom or Teams URL, and the PAL joins that meeting instead of a Tavus room. — [Create Conversation API](https://docs.tavus.io/api-reference/conversations/create-conversation)
  - Google Meet (19 Jun 2026): the PAL can get past the admit prompt.
  - Zoom (31 Jul 2026): via a calendar invite to `@tavusinvite.com`.
  - Teams (12 Sep 2026): via a calendar invite or a URL.

  — [Changelog](https://docs.tavus.io/sections/changelog/changelog.md)

### Inferences
- **Joining a Zoom or Meet call:** Tavus now does this natively, with no need for a bot framework such as Recall.ai. Note that `auto_start_recording` works only in Tavus-hosted rooms.
- **LiveKit or Pipecat with echo mode:** recommended when the agent logic and voice stack must stay in your own code. Tavus becomes a pure lip-synced video renderer.

### Gaps
- Which plan tiers allow `meeting_url` (Zoom/Meet/Teams) joins was not confirmed.
- The quality and reliability of third-party meeting joins were not found in independent reviews.

## 4. Minimal code steps to start a conversation via the API

### Takeaway
Three steps:
1. Get an API key.
2. Optionally `POST /v2/pals` with `system_prompt` and `default_face_id`.
3. `POST https://tavusapi.com/v2/conversations` with a `face_id` and/or `pal_id`, then open or embed the `conversation_url` that comes back.

### Cited Findings
- **Create a PAL:** `POST https://tavusapi.com/v2/pals`, authenticated with the `x-api-key` header. Required fields: `default_face_id`, and `system_prompt` unless the PAL is in echo mode. Example:
  ```bash
  curl -X POST https://tavusapi.com/v2/pals -H "x-api-key: KEY" -H "Content-Type: application/json" \
    -d '{"pipeline_mode":"full","system_prompt":"You are ...","default_face_id":"rc9cff32ceba",
         "layers":{"llm":{"model":"tavus-gemma-4"}}}'
  ```
  For BYO LLM, use `"llm":{"model":"my-model","base_url":"https://my-llm/v1","api_key":"..."}`. — [Create PAL API](https://docs.tavus.io/api-reference/pals/create-pal); [LLM layer](https://docs.tavus.io/sections/conversational-video-interface/pal/llm)
- **Start a conversation:** `POST https://tavusapi.com/v2/conversations` with the `x-api-key` header.
  - **Required fields:** none are strictly marked required, but a Face is needed. Pass it as `face_id`, or let it come from the PAL's default.
  - **Context and greeting:** `conversation_name`, `conversational_context`, `custom_greeting`, `callback_url` (webhooks).
  - **Where it runs:** `meeting_url` (Zoom/Meet/Teams), `require_auth`, `audio_only`, `max_participants`.
  - **Testing and memory:** `test_mode`, `participant_tags` (memory).
  - **Documents:** `document_ids` and `document_tags` (knowledge base).
  - **`properties`:** `max_call_duration` (default 3600 s), `participant_left_timeout`, `participant_absent_timeout` (default 300 s), `enable_recording`, `enable_closed_captions`, `apply_greenscreen`, `languages` (up to 42).

  Example:
  ```bash
  curl -X POST https://tavusapi.com/v2/conversations -H "x-api-key: KEY" -H "Content-Type: application/json" \
    -d '{"face_id":"rc9cff32ceba","pal_id":"pcb7a34da5fe","conversational_context":"...",
         "properties":{"max_call_duration":1800,"participant_left_timeout":60}}'
  ```
  The response contains `conversation_id`, `conversation_url`, `status` (active or ended) and `created_at`, plus `meeting_token` when `require_auth` is set. Errors are 400 (validation or concurrency limit) and 401 (bad key). — [Create Conversation API](https://docs.tavus.io/api-reference/conversations/create-conversation)

### Inferences
- **Free-tier calls:** set `max_call_duration` of 300 or less to match the 5-minute cap.
- **Ending calls:** end conversations explicitly, or set `participant_left_timeout`, so idle rooms don't burn minutes. An end-conversation endpoint was not verified in this session.

### Gaps
- The end-conversation endpoint path and the webhook event payload schema were not fetched.
- Stock face IDs: `rc9cff32ceba` is the docs example and may not be a real stock face. A stock face list is available through the faces API or the dashboard; this was not verified.
