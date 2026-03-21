# Fully Automated Influencer → Content Calendar → Platform Publishing Flow

## User Vision (Summary)

1. **Stage 1 – Influencer Creation**  
   Use ComfyUI backend to create a perfect influencer, lock identity, and persist so every generation uses the same influencer.

2. **Stage 2 – LLM Conversation**  
   LLM asks questions to build a 30-day content calendar with instructions, prompts, niche, theme, and video vs image per day/week.

3. **Stage 3 – Scheduling**  
   Schedule content to platforms: Instagram, Facebook, YouTube, etc.

4. **NSFW Handling**  
   Age-gate 18+ content.

---

## Current State vs Gaps

### What Exists

| Area | Status | Location |
|------|--------|----------|
| ComfyUI integration | ✅ Full client, workflow builder, SFW/NSFW URLs | `src/lib/comfyui/`, `server/worker/core/comfyClient.ts` |
| Influencer schema | ✅ `lora_model_path`, personality, voice | `influencers` table |
| Planner LLM | ✅ Chat → brief → strategy → 30-day calendar | `src/lib/planner/`, `src/app/(dashboard)/planner/`, `/api/planner/chat` |
| Content items | ✅ `prompt_seed`, `post_type`, platform, publish_date | `planner_content_items` |
| Queue to scheduler | ✅ Planner → content_v2 + schedules_v2 | `queuePlannerToScheduler()` |
| Social scheduling | ✅ BullMQ, Instagram/Facebook adapters | `publishScheduledContent`, `/api/social/publish` |
| Age gate | ✅ DOB 18+ cookie, NSFW gating in publish | `/api/age-gate`, `blueprint_users.age_verified_at` |
| SFW/NSFW in planner | ✅ First question asks SFW vs NSFW, brief includes `content_rating` | `MASTER_ASSISTANT_SYSTEM` |

### Critical Gaps

| Gap | Impact |
|-----|--------|
| **No automated influencer creation** | `/create` is marketing only; no ComfyUI-based influencer generation flow |
| **Face/identity not auto-injected** | Worker uses `variables_json` from template + `inputs_json` from request; `influencer.lora_model_path` and IP-Adapter ref images are **not** automatically added when `influencer_id` is set |
| **No “lock identity” UX** | No wizard to generate → approve → lock face → save LoRA/ref image to influencer |
| **Planner ↔ Influencer** | Plans use `influencer_id` but planner chat does not select/create influencer first; no clear “use this influencer” step |
| **Image vs video per item** | `planner_content_items.post_type` exists but `queuePlannerToScheduler` does not map it into generation type (IMAGE vs VIDEO); content items need `media_type: 'image' | 'video'` and workflow selection |
| **Platform stubs** | TikTok, YouTube, OnlyFans, etc. are policy stubs; only Instagram/Facebook are live |
| **Pre-NSFW gate wall** | Age gate exists but no dedicated wall before any NSFW content; planner mentions it but doesn’t block access |

---

## Target Flow (End-to-End)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: CREATE & LOCK INFLUENCER                                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  1. User starts "Create Influencer" flow                                              │
│  2. ComfyUI generates initial face/body variants (txt2img or face workflow)            │
│  3. User selects preferred reference image → "Lock identity"                           │
│  4. System either:                                                                    │
│     a) Trains/uploads LoRA → save path to influencers.lora_model_path                  │
│     b) Saves ref image URL → influencers.reference_image_url                           │
│     c) Uses IP-Adapter with ref image (already supported in Studio UI)               │
│  5. influencer_id + identity config persisted; all future generations use it         │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: LLM → 30-DAY CONTENT CALENDAR                                               │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  1. User selects locked influencer                                                    │
│  2. Planner chat: SFW/NSFW first → niche, platforms, goals, style                     │
│  3. LLM outputs brief → strategy → 30-day content items                                │
│  4. Each item: instructions, prompts (prompt_seed), niche, theme, media_type          │
│     - media_type: 'image' | 'video' (daily or weekly based)                            │
│  5. Brief.content_rating drives NSFW gating; if NSFW → require age verification       │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: GENERATION & SCHEDULING                                                     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  1. queuePlannerToScheduler creates content_v2 + schedules_v2                          │
│  2. For each content item needing asset:                                               │
│     - Select workflow by media_type (IMAGE vs VIDEO) + content_policy (SFW/NSFW)      │
│     - Inject influencer_id → auto-add LoRA + ref image from influencer                 │
│     - Use prompt_seed + instructions as prompt                                       │
│  3. Worker processes generation → stores asset → links to content_v2                  │
│  4. schedules_v2.scheduled_for + platform → publish worker dispatches when due        │
│  5. NSFW content: hasVerifiedNsfwAccess() must pass before publish                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Face Lock & Identity Persistence

**Goal:** Create influencer with ComfyUI, lock identity, always use it in generations.

| Task | Details |
|------|---------|
| 1.1 Add `reference_image_url` to influencers | Migration; store URL of locked face/body reference |
| 1.2 Create `/create/influencer` wizard | Multi-step: generate → select → lock → save |
| 1.3 ComfyUI workflow for “identity base” | Use existing txt2img or face-specific template |
| 1.4 Inject influencer identity in worker | In `processGeneration`: if influencer has `lora_model_path` or `reference_image_url`, add to `finalInputs` and ensure `variables_json` maps them into workflow (or extend `resolveWorkflow` to accept influencer context) |
| 1.5 Workflow templates | Add placeholders like `{{lora_path}}`, `{{reference_image}}` where IP-Adapter / LoRA loader nodes expect them |

### Phase 2: Planner ↔ Influencer & Media Type

**Goal:** Planner uses locked influencer; content items specify image vs video.

| Task | Details |
|------|---------|
| 2.1 Planner “select influencer” step | Before or during chat, user picks influencer; stored in `planner_plans.influencer_id` |
| 2.2 Extend `planner_content_items` | Add `media_type text check (media_type in ('image','video'))` (or reuse `post_type` with clear mapping) |
| 2.3 LLM calendar prompt | Include `media_type` per item; vary image/video by day or week |
| 2.4 queuePlannerToScheduler | Map `media_type` → workflow slug (e.g. `sfw-txt2img-v1` vs `sfw-video-v1`) |

### Phase 3: Auto-Generation Pipeline

**Goal:** Content items trigger image/video generation with influencer identity.

| Task | Details |
|------|---------|
| 3.1 Content item → generation job | When queueing planner to scheduler, for items needing assets, create `content_v2` with placeholder; enqueue `content_v2_safe_image` (or future video) job |
| 3.2 Worker passes influencer_id | `processSafeImageV2` loads content_v2 → creator_id → legacy creator (influencer); job gets influencer_id |
| 3.3 Prompt from content item | Use `prompt_seed` + `hook` + `caption_direction` as final prompt |

### Phase 4: Platform Expansion & NSFW Gate Wall

**Goal:** More platforms; clear 18+ gate before NSFW.

| Task | Details |
|------|---------|
| 4.1 Platform adapters | Implement TikTok, YouTube, OnlyFans (etc.) publish adapters alongside Instagram/Facebook |
| 4.2 Pre-NSFW gate | Middleware or layout: if route serves NSFW (e.g. vault, NSFW planner), check `age_verified_18` + `nexgen_nsfw_gate_enabled`; redirect to `/settings/verification` or dedicated age-gate page if not verified |
| 4.3 Planner NSFW branch | When brief.content_rating = 'nsfw', require verification before generating calendar |

---

## Schema Additions (Proposed)

```sql
-- influencers: add reference image for IP-Adapter face lock
alter table influencers add column if not exists reference_image_url text;
alter table influencers add column if not exists reference_image_storage_key text;

-- planner_content_items: explicit media type for generation
alter table planner_content_items add column if not exists media_type text 
  check (media_type in ('image','video'));
```

---

## Portfolio vs Socials (Separate Purposes)

| Area | Purpose | Location |
|------|---------|----------|
| **Portfolio** | Analytics dashboard: creators, content, schedules, revenue, engagement. Read-only metrics. | `/portfolio`, `/intelligence` |
| **Socials** | **Link your platform accounts** for automation. Users connect Instagram, TikTok, YouTube, Facebook (SFW) and OnlyFans, Fanvue, Fansly (NSFW behind 18+ gate) via OAuth API or webhook. | `/dashboard/social`, nav: "Socials" |

- SFW platforms: connect anytime.
- NSFW platforms (OnlyFans, Fanvue, Fansly): require 18+ verification in Settings before Connect is enabled.
- Integration: OAuth for live connectors; webhook for platform callbacks. Use API or webhook depending on platform best practice.

---

## File Touchpoints

| Purpose | Files |
|---------|-------|
| Influencer creation UI | `src/app/(dashboard)/create/` (new wizard), `src/components/creators/` |
| Planner + influencer | `src/app/(dashboard)/planner/page.tsx`, `src/components/planner/ChatPanel.tsx`, `src/lib/planner/actions.ts` |
| Worker identity injection | `server/worker/processors/processGeneration.ts`, `server/worker/core/workflow.ts` |
| Queue planner → content | `src/lib/automation/queuePlannerToScheduler.ts` |
| Content generation | `src/app/api/content/generate/route.ts`, `server/worker/processors/processSafeImageV2.ts` |
| Age gate | `src/proxy.ts` or `src/middleware.ts`, `src/app/(dashboard)/settings/verification/page.tsx` |
| Workflow templates | Add to `variables_json.fields`: `lora_path` (node/path for LoRA loader), `reference_image_url` (node/path for LoadImage/IP-Adapter). Worker auto-injects when influencer has these set. |

---

## Recommended Order

1. **Phase 1** – Without face lock, every generation is ad-hoc; this is the foundation.
2. **Phase 2** – Planner already works; adding influencer selection and media_type is low-risk.
3. **Phase 3** – Connects planner output to ComfyUI with locked identity.
4. **Phase 4** – Platform expansion and NSFW wall can run in parallel.

---

## Existing Pieces to Reuse

- `StudioGenerationControls.tsx`: IP-Adapter, LoRA, reference image already in UI
- `MASTER_ASSISTANT_SYSTEM`: SFW/NSFW first, brief extraction, calendar generation
- `queuePlannerToScheduler`: Planner → content_v2 + schedules_v2
- `processSafeImageV2`: Content-driven image generation
- `publishScheduledContent`: Age verification check before NSFW publish
