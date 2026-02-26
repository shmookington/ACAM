# ACAM Voice AI Integration Roadmap (Phase 2)

**Goal:** Evolve ACAM's Human Dialer (Phase 1) into a fully autonomous Voice AI agent that can dial leads, handle interruptions in real-time, and execute the DeepSeek-generated call scripts autonomously.

## The Technical Challenge
Voice AI is latency-sensitive. Traditional LLM text generation is too slow for a natural phone conversation. You need instantaneous Voice Activity Detection (VAD) to know when the user speaks, handle interruptions ("Stop talking"), and stream audio back via Text-to-Speech (TTS).

## The Required Stack

To accomplish this without building low-level WebRTC/Audio streaming logic from scratch, we must use an open-source conversational AI framework.

### 1. The Orchestration Framework: Pipecat (by Daily) or LiveKit
*   **Why Pipecat:** It's an open-source framework specifically built for Voice/Multimodal AI. It handles the brutal parts: WebRTC transport, audio buffering, and VAD (Voice Activity Detection).
*   **How it works in ACAM:** We run a Node.js/Python microservice alongside ACAM. When you click "Auto-Dial", ACAM sends the generated `phone_script` and lead details to the Pipecat server. Pipecat initiates the call and manages the audio stream.

### 2. Speech-to-Text (STT): Deepgram
*   **Why Deepgram:** Fastest real-time transcription in the industry. It listens to the prospect and converts their audio to text instantaneously, which we then feed to the brain.

### 3. The Brain (LLM): DeepSeek / OpenAI
*   **Why:** We use the same LLM we use for the scripts. But instead of generating a static 3-minute script, we feed the LLM the lead's data and a strict system prompt instructing it to act as the Caelborne sales rep, advancing the pitch based on Deepgram's inputs.

### 4. Text-to-Speech (TTS): Cartesia or ElevenLabs
*   **Why Cartesia:** Extremely low latency (<150ms) and very human-like "Sonic" voices. ElevenLabs is slightly better quality but higher latency. Cartesia is usually preferred for real-time conversational bots so there are no awkward pauses.

### 5. Telephony (The Phone Number): Twilio or Vondage
*   **Why:** ACAM needs a real phone number to call out from. Pipecat connects via SIP to Twilio.

## Implementation Steps (When we return to this)

1. **Setup Telephony:** Buy a Twilio phone number and configure SIP Trunking.
2. **Provision Microservice:** Spin up a background server (likely Python-based using `pipecat-ai`) to handle the constant audio streaming (Next.js serverless functions cannot handle persistent WebSocket audio streams).
3. **Connect the Stack:**
    *   `Twilio` (Calls lead) <--> `Pipecat` (Manages flow) <--> `Deepgram` (Listens) <--> `DeepSeek` (Thinks) <--> `Cartesia` (Speaks).
4. **Update ACAM UI:** Add a new "Deploy AI Caller" button next to the current "Setup Call" button on the lead cards.
5. **Prompt Engineering:** Convert the current static markdown script into a reactive System Prompt for the Voice LLM, training it on objection handling.
