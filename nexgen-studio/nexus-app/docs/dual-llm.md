# Dual-LLM Architecture

Two separate LLMs are used in NexGen Studio:

- **Persona LLM** — In-character replies (comments, DMs, engagement, captions). Stays in character, uses influencer personality and lore.
- **General LLM** — Platform help (“How do I…?”, “What does this button do?”). Factual, neutral, no roleplay.

## API Routes

| Route | Purpose |
|-------|--------|
| `POST /api/llm/persona` | Influencer automation: comment replies, DMs, caption generation. |
| `POST /api/llm/general` | Platform help, how-to, support. |
| `POST /api/llm/router` | Optional: classify a message as `persona` or `general`. |

## Environment Variables

- `OPENAI_API_KEY` — Required for all LLM routes.
- `OPENAI_BASE_URL` — Optional; for Azure or proxy.
- `OPENAI_PERSONA_MODEL` — Optional; default `gpt-4o` (creative).
- `OPENAI_GENERAL_MODEL` — Optional; default `gpt-4o-mini` (fast, accurate).
- `OPENAI_ROUTER_MODEL` — Optional; default `gpt-4o-mini` for classifier.

## Supabase: Influencer Persona Fields

After running the migration `20260306_llm_persona_fields.sql`:

- `influencers.personality_json` — Structured personality (traits, tone, do/don’t).
- `influencers.lore_memory` — Backstory and persistent lore.
- `influencers.voice_style` — Voice description (e.g. playful, sarcastic).
- `engagement_logs` — Optional table for conversation history.

## Frontend Hooks

```ts
import { usePersonaLLM, useGeneralLLM, useLLMRouter } from '@/hooks'

// In-character reply (Studio caption, Automation, DMs)
const { reply, error, isLoading, send } = usePersonaLLM({
  influencerId: '...',
  context: { recentPosts: ['...'], contextHint: 'Caption for a reel' },
})
await send([{ role: 'user', content: 'Write a short caption for my gym selfie' }])

// Platform help (help button, onboarding)
const { reply, ask } = useGeneralLLM({ scope: 'studio' })
await ask('How do I generate a video?')

// Optional: auto-route a single message
const { route, classify } = useLLMRouter()
const route = await classify('What is CFG?') // 'general'
```

## Where Each LLM Is Used

- **Automation → Engagement** → Persona LLM  
- **Help / Onboarding / Docs** → General LLM  
- **Studio → Caption generator** → Persona LLM  
- **Studio → Prompt helper** → General LLM  
- **Agency → Client reporting** → General LLM  

## Routing

- **Option A (explicit):** Frontend decides: “talking to influencer” → `/api/llm/persona`, “platform question” → `/api/llm/general`.
- **Option B (automatic):** Call `POST /api/llm/router` with the message, then call the returned route’s API.
