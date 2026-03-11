# Automation JSON Spec — Pipeline-Driven Architecture

This doc defines production-style JSON structures that drive the full pipeline: **Brief → Strategy → Calendar → Generation → Captions → Scheduling → Posting → Analytics**. The goal is for every JSON payload to be executable by backend workers, schedulers, and posting APIs—not just stored metadata.

---

## 1. Creator Brief JSON (Source Configuration)

**Purpose:** Stored per creator/influencer; feeds Strategy Generator and downstream stages.

```json
{
  "creator_profile": {
    "brand_name": "Dark Feminine AI Influencer",
    "personality": ["confident", "playful", "mysterious", "seductive"],
    "aesthetic": "dark feminine luxury",
    "color_palette": ["black", "gold", "deep red"],
    "content_themes": [
      "luxury lifestyle",
      "gym aesthetic",
      "cosplay",
      "nightlife",
      "flirt teasing"
    ]
  },
  "platforms": {
    "tiktok": { "posts_per_day": 2 },
    "instagram": { "posts_per_day": 1.5 },
    "x": { "posts_per_day": 3 },
    "reddit": { "posts_per_week": 4 },
    "vault": { "posts_per_day": 1 }
  },
  "generation_models": {
    "primary": "FLUX",
    "secondary": "SDXL",
    "character_model": "custom_lora",
    "source": "CivitAI"
  },
  "visual_constraints": {
    "avoid": [
      "anime", "cartoon", "neon palettes",
      "distorted anatomy", "low quality renders"
    ],
    "emphasize": [
      "cinematic lighting", "luxury interiors",
      "realistic skin texture", "professional photography"
    ]
  }
}
```

### Current schema mapping

| Spec field | Existing storage |
|------------|------------------|
| creator_profile | `influencers` (personality_json, lore_memory, niche), `planner_plan_briefs` (niche, tone, audience_json) |
| platforms | `planner_plan_briefs.platforms_json`, `posting_frequency_json` |
| generation_models | Not structured; `influencers.lora_model_path`, workflow templates |
| visual_constraints | `planner_plan_briefs.constraints_json` (avoid/prefer) |

---

## 2. Content Calendar JSON (Automation Engine)

**Purpose:** Per-day, per-platform items that drive generation and scheduling.

```json
{
  "calendar": [
    {
      "date": "2026-03-11",
      "platform": "tiktok",
      "content_type": "viral_hook",
      "theme": "gym tease",
      "aspect_ratio": "9:16",
      "generation_prompt": "luxury dark feminine influencer gym selfie mirror pose cinematic lighting realistic photography",
      "caption_style": "flirty",
      "cta": "follow_for_more"
    },
    {
      "date": "2026-03-11",
      "platform": "instagram",
      "content_type": "reel",
      "theme": "luxury lifestyle",
      "aspect_ratio": "9:16",
      "generation_prompt": "dark feminine influencer luxury apartment window lighting high fashion outfit cinematic mood",
      "caption_style": "teasing",
      "cta": "link_in_bio"
    }
  ]
}
```

### Current schema mapping

| Spec field | Existing storage |
|------------|------------------|
| date | `planner_content_items.publish_date` |
| platform | `planner_content_items.platform` |
| content_type | `planner_content_items.post_type` |
| theme | `planner_content_items.content_pillar` or new column |
| aspect_ratio | Not stored; add to content_items or data JSONB |
| generation_prompt | `planner_content_items.prompt_seed` |
| caption_style | `planner_content_items.caption_direction` |
| cta | `planner_content_items.cta` |

**Gap:** Add `aspect_ratio` and `content_type` explicitly; align naming (generation_prompt ↔ prompt_seed).

---

## 3. Generation Job JSON (GPU / ComfyUI Workers)

**Purpose:** Exact payload sent to RunPod / ComfyUI / Vast workers.

```json
{
  "job_type": "image_generation",
  "model": "FLUX",
  "lora": "influencer_identity_v1",
  "prompt": "dark feminine luxury influencer gym mirror selfie cinematic lighting realistic skin texture",
  "negative_prompt": "anime, cartoon, neon colors, distorted anatomy",
  "seed": 428199,
  "width": 1024,
  "height": 1792,
  "steps": 30
}
```

### Current flow

- `generation_jobs.inputs_json` carries prompt, negative_prompt, etc.
- Worker uses `resolveWorkflow()` + `variables_json` to inject into ComfyUI workflow.
- `influencer.lora_model_path` / `reference_image_storage_key` auto-injected for face lock.

**Gap:** Ensure `inputs_json` explicitly supports model, lora, width, height, seed, steps per this spec.

---

## 4. Caption Generation Input

**Purpose:** Input to AI caption engine; output used in scheduler.

```json
{
  "platform": "tiktok",
  "tone": "flirty",
  "theme": "gym tease",
  "cta": "follow_for_more"
}
```

**Example output:** *"Should I keep posting gym content like this? 👀🔥"*

### Current flow

- Planner items have `caption_direction`, `hook`, `angle`, `cta`.
- LLM persona can generate captions from personality + context.
- Need dedicated caption-generation step before scheduling.

---

## 5. Scheduler / Post Queue JSON

**Purpose:** What the scheduler and posting APIs consume.

```json
{
  "post_queue": {
    "platform": "instagram",
    "publish_time": "2026-03-11T18:30:00Z",
    "media_url": "generated_image_001.jpg",
    "caption": "Late night energy 🖤",
    "hashtags": ["#aiinfluencer", "#darkfeminine", "#luxurylifestyle"]
  }
}
```

### Current flow

- `content_v2` + `schedules_v2` store platform, scheduled_for, status.
- `queuePlannerToScheduler()` maps planner items → content_v2 + schedules_v2.
- Publish worker picks due items and posts via platform adapters.

**Gap:** Ensure `content_v2.data` or equivalent stores media_url, caption, hashtags in this shape for posting.

---

## 6. Full Pipeline Architecture

```
Creator Brief (JSON)
        ↓
Strategy Generator (LLM)
        ↓
Content Calendar Engine (LLM)
        ↓
Prompt Generator (merge brief + calendar item)
        ↓
GPU Generation Workers (RunPod / ComfyUI / Vast)
        ↓
Caption AI (LLM)
        ↓
Scheduler (BullMQ + schedules_v2)
        ↓
Platform Posting APIs (Instagram, TikTok, X, Vault, etc.)
        ↓
Analytics + Optimization
```

### Current implementation

| Stage | Status |
|-------|--------|
| Creator Brief | `planner_plan_briefs`; structure differs from spec |
| Strategy | `planner_strategy_profiles`; LLM-driven |
| Calendar | `planner_content_items`; LLM-driven |
| Prompt → GPU | `queuePlannerToScheduler` → `content_v2` → `content_v2_safe_image` job |
| Caption AI | Partial (persona LLM); no dedicated caption step |
| Scheduler | `schedules_v2`, BullMQ, publish workers |
| Posting | Instagram, Facebook live; others stubs |
| Analytics | `performance_v2`, analytics snapshots |

---

## 7. AI Content Director (Differentiator)

**Concept:** Instead of static calendars, analytics drive strategy adjustment.

Example flow:

```
TikTok gym content performing 2.3x better
        ↓
Increase gym-themed posts next week
        ↓
Reduce cosplay posts
```

**Implementation path:**

1. Store per-content performance (engagement, views, conversions) in `performance_v2` or analytics tables.
2. Periodic job (daily/weekly): Aggregate by theme, platform, content_type.
3. LLM or rule engine: Compare to baseline, output adjustment recommendations.
4. Auto-update next calendar window: shift theme mix, increase/decrease slots by theme.
5. Persist "strategy adjustments" in a new table (e.g. `planner_strategy_adjustments`) for audit and rollback.

---

## Migration & Alignment Tasks

1. **Brief schema:** Extend `planner_plan_briefs` or influencers to store `creator_profile`, `platforms` (posts_per_day format), `generation_models`, `visual_constraints` per spec.
2. **Content items:** Add `aspect_ratio`, align `generation_prompt` ↔ `prompt_seed`; ensure `content_type` maps to `post_type`.
3. **Generation jobs:** Standardize `inputs_json` to include model, lora, width, height, seed, steps.
4. **Caption step:** Add caption-generation job between asset creation and scheduling; feed platform, tone, theme, cta.
5. **Post queue:** Align `content_v2.data` with post_queue shape (media_url, caption, hashtags).
6. **AI Content Director:** Design analytics → strategy adjustment flow; add tables and worker.

---

## File Touchpoints

| Spec Area | Relevant Files |
|-----------|----------------|
| Brief | `planner_plan_briefs`, `influencers`, `planner/prompts.ts` |
| Calendar | `planner_content_items`, `queuePlannerToScheduler.ts`, `planner/actions.ts` |
| Generation | `processGeneration.ts`, `processSafeImageV2.ts`, `workflow-builder.ts` |
| Caption | `persona-prompts.ts`, `/api/llm/persona`, new caption API |
| Scheduler | `schedules_v2`, `publishScheduledContent.ts`, `publishWorker.ts` |
| Analytics | `performance_v2`, `analyticsWorker.ts`, portfolio/analytics APIs |
