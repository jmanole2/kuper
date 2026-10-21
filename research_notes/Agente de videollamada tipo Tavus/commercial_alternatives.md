# Commercial real-time interactive AI avatar APIs: alternatives to Tavus CVI (free tiers and cost, as of Oct 2026)

All pages were fetched or searched on 2026-10-21. Prices change often, so check each figure on the vendor's page before relying on it. Claims from third-party aggregators are flagged.

## Q1: Free tier, per-minute price, latency, custom avatar, BYO-LLM and Spanish for each vendor

### Takeaway
For a prototype, the cheapest hosted avatar renderers are **Simli**: 50 free min/month, then about $0.01/min. **bitHuman** is next: 99 free credits/month, then about $0.04/min on its cloud or $0.02/min self-hosted. Both are "avatar-only" renderers that you drive with your own STT/LLM/TTS through LiveKit or Pipecat. **Anam**: 30 free min, then $0.11–0.16/min. **Beyond Presence**: 20–40 free min, then €0.10–0.35/min. **LiveAvatar** (HeyGen): 10 free credits/month, which is about 10 min in LITE mode; paid plans start at $99. These cost about the same as Tavus or less. Tavus is the baseline at 20–25 free min and $0.26–0.37/min. **Hedra Realtime Avatar was discontinued** on 2026-04-15.

### Cited Findings

**Tavus CVI (baseline)**
- Tavus's pricing page shows several conflicting versions. One version: Free $0 with 20 CVI min/mo and 1 concurrent session. Starter $22/mo with 60 min. Builder $59/mo with 175 min and $0.35/min overage. Growth $397/mo with 1,300 min and $0.31/min. Business $975/mo with 4,000 min and $0.26/min. Another version on the same page: Free 25 min; $59 for 100 min at $0.37/min overage; $397 for 1,250 min at $0.32/min. — [Tavus pricing](https://www.tavus.io/pricing)

**Simli**
- Free $0/mo: 50 min/month, 1 concurrent session, template avatars only. — [Simli pricing](https://www.simli.com/pricing)
- Hobby $10/mo: 1,000 min at $0.01/min, 2 concurrent, 1 custom avatar/mo. Pro $49/mo: 5,500 min at $0.0095/min, 10 concurrent, 5 custom avatars/mo. Scale $249/mo: 27,500 min at $0.009/min, 50 concurrent. Enterprise: "as low as $0.005/min". The page's headline is "less than a penny a minute." — [Simli pricing](https://www.simli.com/pricing)
- The pricing page makes no latency claim and does not list languages. It has an FAQ entry on using your own LLM, voice and language, but the answer could not be extracted. — [Simli pricing](https://www.simli.com/pricing)
- Has an official Pipecat service (maintained by Pipecat) and a LiveKit plugin (Python only). — [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services); [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/)

**HeyGen Interactive / Streaming Avatar → LiveAvatar**
- LiveAvatar is HeyGen's real-time avatar product. Free plan: $0 with 10 credits/month and no overage. Essential: $99 with 1,100 (+10) credits and $0.095 per extra credit. Business: $475 with 6,000 (+10) credits and $0.09 per extra credit. — [LiveAvatar credits FAQ](https://docs.liveavatar.com/docs/faq/credits)
- FULL (Embed) mode costs 2 credits/min. In FULL mode HeyGen hosts the whole pipeline (STT, LLM and TTS). "Avatar Only" (LITE) mode costs 1 credit/min; there you bring your own pipeline. In practice that is about $0.09–0.10/min for LITE and $0.18–0.19/min for FULL on paid plans. The free 10 credits come to about 10 LITE min or 5 FULL min per month. — [LiveAvatar credits FAQ](https://docs.liveavatar.com/docs/faq/credits); [LiveAvatar LITE mode docs](https://docs.liveavatar.com/docs/lite-mode/overview)
- A third-party SitePal blog lists different plans: Starter $19 for 150 credits (about $0.13/min), Essential $99, and Business $475 for 5,000. This conflicts with the official docs. — [SitePal blog](https://www.sitepal.com/blog/?p=577)
- One review says to "wait for LiveAvatar maturity" because it is still early in 2026. This is opinion. — [roborhythms review](https://www.roborhythms.com/heygen-review/)
- HeyGen's general video-generation API is pay-as-you-go, and HeyGen reportedly no longer offers free API credits (third-party source). — [anam.ai blog on HeyGen pricing](https://anam.ai/blog/heygen-pricing)
- LiveKit has a LiveAvatar plugin (Python only). Pipecat has a "HeyGen" video service and transport maintained by Pipecat. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/); [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)

**Anam**
- Plans from the comparison table:

  | Plan | Price/mo | Included min | Overage | Concurrent sessions | Max session length |
  |---|---|---|---|---|---|
  | Free | $0 | 30 | none | 1 | 3 min |
  | Starter | $12 | 50 | $0.16/min | 1 | 5 min |
  | Explorer | $49 | 250 | $0.14/min | 3 | 10 min |
  | Growth | $299 | 2,000 | $0.12/min | 5 | 2 h |
  | Professional | $999 | 8,000 | $0.11/min | 10 | 2 h |
  | Enterprise | custom | — | $0.04/min | 100+ | — |

  The Free plan card text says 50 min, which conflicts with the table's 30. — [Anam pricing](https://anam.ai/pricing)
- Custom avatars are unlimited on every plan. You upload an image or generate one from a text prompt, and generation takes under 2 minutes. — [Anam pricing](https://anam.ai/pricing)
- Supports 70+ languages on all plans, which should include Spanish (inferred; Spanish is not named). The page gives no latency figure but links to an "Avatar Benchmark" tool. BYO-LLM is not mentioned on the pricing page. — [Anam pricing](https://anam.ai/pricing)
- Has a LiveKit plugin (Python and Node) and a community Pipecat integration. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/); [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)

**Beyond Presence (bey)**
- Free: 40 min of speech-to-video (avatar-only; you bring the audio) or 20 min of its hosted conversational agents. Starter: 280/140 min, overage €0.175/min (speech-to-video) or €0.35/min (agents), 1 custom avatar. Growth: €0.10/€0.20 per min, 3 custom avatars. Scale: €0.0875/€0.175 per min, 10 custom avatars. Enterprise speech-to-video goes as low as €0.03/min. — [Beyond Presence pricing](https://www.beyondpresence.ai/pricing)
- Languages: 100+ for speech-to-video and 30+ for agents. The pricing table has a "Custom LLM Support" row, but which tiers include it could not be extracted. No latency figure is given. — [Beyond Presence pricing](https://www.beyondpresence.ai/pricing)
- Has a LiveKit plugin (Python and Node) and a community Pipecat transport. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/); [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)

**bitHuman**
- Free: $0 with 99 credits/mo and 1 cloud session. Creator: $20 for 2,000 credits (about 500 cloud min), 3 concurrent. Pro: $99 for 12,000 credits (about 3,000 min). Business: $299 for 50,000 credits. Top-ups cost $1 per 100 credits. — [bitHuman pricing](https://www.bithuman.ai/pricing)
- Per-minute rates:
  - Self-hosted (your own server or device): 2 credits/min, about $0.02. Billed only for speaking seconds.
  - bitHuman cloud: 4 credits/min, about $0.04.
  - Managed voice chat: 10 credits/min, about $0.10.

  The free 99 credits come to about 25 cloud min or about 50 self-hosted min. — [bitHuman pricing](https://www.bithuman.ai/pricing)
- You can create a custom avatar from a portrait image for a one-time 500 credits (Essence 2) or 2,000 credits (Expression 2). Self-hosted rendering runs on-device (iOS, Android, Mac, Linux, browsers with WebGPU). Languages are not listed. — [bitHuman pricing](https://www.bithuman.ai/pricing)
- Has a LiveKit plugin (Python) and a community Pipecat integration. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/); [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)

**D-ID (Agents / Streams)**
- The official API pricing page could not be extracted: the fetch returned only navigation. — [D-ID API pricing](https://www.d-id.com/pricing/api/)
- A third-party source (Creatify, 2026) lists these API plans:
  - Trial: free, up to 10 streaming min, personal use only.
  - Build: $14.40/mo for 64 credits, up to 32 streaming min, personal use only.
  - Launch: $35/mo for 180 credits, up to 90 streaming min, commercial license.
  - Scale: $138.60/mo for 800 credits, up to 400 streaming min.

  That works out to about $0.35–0.45 per streaming minute (my arithmetic). — [Creatify blog](https://creatify.ai/blog/d-id-pricing-(2026)-plans-credits-and-what-you-ll-actually-pay)
- This conflicts with Argil (May 2026), which describes the trial as about 5 min of watermarked video per month with no commercial use. — [Argil blog](https://v2.argil.ai/blog/d-id-pricing-5be73)
- Has a LiveKit plugin (Python and Node). It is not in Pipecat's list. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/)

**Hedra realtime avatars**
- **Discontinued.** LiveKit docs say Hedra sunset its Realtime Avatar product on 2026-04-15 and the plugin no longer works. — [LiveKit Hedra plugin page](https://docs.livekit.io/agents/models/avatar/plugins/hedra.md)

**Akool Streaming Avatar**
- Billed in credits. Streaming at 1080p costs 1.2 credits per 10 s (Pro Max) or 1 credit per 10 s (Business), with API concurrency of 3 and 5 streams. Another Akool page lists 1.7 credits per 10 s on the first tier. — [Akool API pricing](https://akool.com/en-us/api-pricing); [Akool API pricing (alt)](https://akool.com/api-pricing)
- A page labelled "test" gives $0.05/credit. At that rate streaming costs about $0.30–0.51/min (my arithmetic), which makes Akool one of the pricier options. — [Akool test page](https://akool.com/ai-tools/test)
- Not in LiveKit's or Pipecat's plugin lists. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/); [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)

**Synthesia and others**
- Synthesia now has a LiveKit avatar plugin (Python). Pricing was not researched. LiveKit also lists Avatario, AvatarTalk, Keyframe, LemonSlice, Protoface, Runway, Spatius and TruGen. — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/)

### Inferences
- Cheapest path to a working Spanish-speaking prototype: LiveKit Agents (free Build plan) plus Simli or bitHuman as the avatar, plus free or cheap STT/LLM/TTS that handle Spanish. Examples: Deepgram with its $200 credit, Gemini or Groq free tiers, and Cartesia or ElevenLabs. Because the avatar only lip-syncs your TTS audio, Spanish support depends on the STT, LLM and TTS, not the avatar vendor.
- For an "all-in-one like Tavus" option (hosted LLM and voice), LiveAvatar FULL mode, Anam, or Beyond Presence agents are the closest. Their free minutes are small: about 5–30 min.
- Avatar-only renderers are cheaper per minute than Tavus. Simli is about $0.01, bitHuman cloud about $0.04, and Beyond Presence speech-to-video €0.09–0.175. Tavus is $0.26–0.37.

### Gaps
- No vendor published a reliable latency figure on the pricing pages I could reach. Latency should be measured, or taken from vendor docs and the Anam benchmark.
- Spanish support was not explicitly confirmed by Simli, bitHuman or D-ID.
- D-ID's official API pricing could not be read, so its figures above are third-party only.
- Akool's free trial and the dollar value of its credits are unverified.
- BYO-LLM details are unconfirmed for Simli and Beyond Presence. Avatar-only modes are BYO by design.

## Q2: Which vendors have official plugins for LiveKit Agents and/or Pipecat?

### Takeaway
LiveKit Agents has the broadest coverage, with 16 avatar plugins. Anam, Beyond Presence, bitHuman, D-ID, LiveAvatar, Simli, Synthesia and Tavus all have one. Pipecat maintains HeyGen, Simli, Tavus and LemonSlice itself. Anam, bitHuman, Beyond Presence and Protoface are community integrations for Pipecat.

### Cited Findings
- LiveKit's avatar plugins: Anam (Py/Node), Avatario (Py), AvatarTalk (Py), Beyond Presence (Py/Node), bitHuman (Py), D-ID (Py/Node), Keyframe (Py), LemonSlice (Py/Node), LiveAvatar (Py), Protoface (Py/Node), Runway (Py/Node), Simli (Py), Spatius (Py), Synthesia (Py), Tavus (Py/Node), TruGen (Py/Node). — [LiveKit avatar docs](https://docs.livekit.io/agents/models/avatar/)
- Hedra's LiveKit plugin is defunct after the product sunset (2026-04-15). — [LiveKit Hedra page](https://docs.livekit.io/agents/models/avatar/plugins/hedra.md)
- Pipecat video services: Anam (community), bitHuman (community), HeyGen (Pipecat), Protoface (community), Simli (Pipecat), Tavus (Pipecat). — [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)
- Pipecat avatar-related transports: Beyond Presence (community), HeyGen, LemonSlice and Tavus (Pipecat-maintained). — [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)
- Pipecat also lists local or free model options: Whisper, Moonshine and FunASR for STT; Ollama for the LLM; Kokoro, Piper and Pocket TTS for TTS. — [Pipecat supported services](https://docs.pipecat.ai/server/services/supported-services)

### Inferences
- Akool and D-ID (on Pipecat) need custom integration.

### Gaps
- I did not verify whether Pipecat's "HeyGen" service targets the legacy Interactive Avatar API or the new LiveAvatar API.

## Q3: Free tiers of the surrounding pieces (transport, LLM, STT, TTS)

### Takeaway
LiveKit Cloud's free Build plan covers a prototype easily: 1,000 agent-session min, 5,000 WebRTC min, 5 concurrent sessions, $2.50 of inference credit, and no card required. Daily gives 10,000 free participant-minutes/month. For the models: Deepgram has a $200 signup credit, and Gemini and Groq have free tiers. ElevenLabs gives 10k credits/month, which is about 5–10 min of speech.

### Cited Findings
- **LiveKit Cloud.** Build plan: $0, no credit card, 1,000 agent-session min, 5 concurrent agent sessions, 1 deployment, 5,000 WebRTC min, 100 concurrent connections, $2.50 of inference credits (about 50 min), 50 GB of egress, community support. Ship plan: from $50/mo, 5,000 agent min then $0.01/min, 20 concurrent sessions, 150,000 WebRTC min. — [LiveKit pricing](https://livekit.com/pricing)
- **Daily.** 10,000 free participant-min/month with no card required. Pay-as-you-go is about $0.004 per participant-min for video. — [Daily blog](https://www.daily.co/blog/announcing-our-new-pricing/); [CostBench](https://www.costbench.com/software/video-conferencing/daily-co/) (third-party)
- **Gemini API / Gemini Live.** Google has a free tier with lower rate limits; free-tier data may be used to improve Google's products. — [Google AI pricing](https://ai.google.dev/gemini-api/docs/pricing)
  - Third-party paid figures for 2.5 Flash Native Audio: $3.00/1M audio input tokens and $12.00/1M audio output tokens. Audio is billed at about 25 tokens/s. — [cloudprice](https://cloudprice.net/models/gemini-live-2.5-flash-native-audio); [Google forum](https://discuss.ai.google.dev/t/live-api-pricing-audio-tokens-second-silent-audio/92653)
  - 3.1 Flash Live preview reportedly costs about $3.00/1M audio input tokens (unverified). — [makerstack review](https://makerstack.co/reviews/gemini-flash-live-review/)
- **Deepgram.** $200 signup credit with no card required. Sources conflict on whether it expires after 1 year or never. — [Gladia blog](https://gladia.io/blog/deepgram-pricing); [agentdeals](https://agentdeals.dev/vendor/deepgram) (third-party)
- **Groq.** Described as a true free tier with no card required. Specific rate limits were not found. — [toolfreebie](https://toolfreebie.com/?p=237) (third-party)
- **ElevenLabs.** Free plan with 10,000 credits/month, about 5–10 min of TTS. Its conversational agent is reportedly about $0.08/min (June 2026, unverified). — [HappyRobot](https://www.happyrobot.ai/hub/elevenlabs-pricing); [Puter](https://developer.puter.com/tutorials/elevenlabs-api-pricing/) (third-party)

### Inferences
- A prototype could cost $0 for its first weeks. One example stack: LiveKit Build, Simli Free (50 min) or bitHuman Free, Deepgram's $200 credit, the Gemini or Groq free-tier LLM, and Cartesia or ElevenLabs free TTS (or LiveKit's $2.50 of inference credit). Gemini Live could replace STT, LLM and TTS with one speech-to-speech model. The avatar's free minutes are the binding constraint.

### Gaps
- I found no reliable figures for OpenAI Realtime (gpt-realtime) per-minute or token pricing. Check openai.com/api/pricing.
- Cartesia's free-plan credits were not found.
- Groq's exact free-tier rate limits were not found.
- Gemini Live free-tier rate limits and Spanish native-audio quality were not verified.
