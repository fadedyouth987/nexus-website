# Automation Pipeline Implementation Status

> This document tracks implementation progress against the phases defined in [AUTOMATION_FLOW_ARCHITECTURE.md](./AUTOMATION_FLOW_ARCHITECTURE.md).
> Last updated: 2026-04-06

## Overview

| Phase | Status | Progress | Target Completion |
|-------|--------|----------|-------------------|
| Phase 1: Face Lock & Identity Persistence | 🔴 Not Started | 0% | TBD |
| Phase 2: Planner ↔ Influencer & Media Type | 🔴 Not Started | 0% | TBD |
| Phase 3: Auto-Generation Pipeline | 🔴 Not Started | 0% | TBD |
| Phase 4: Platform Expansion & NSFW Gate Wall | 🟡 Partial | 40% | TBD |

**Legend:**
- 🔴 Not Started
- 🟡 In Progress / Partial
- 🟢 Complete

---

## Phase 1: Face Lock & Identity Persistence

**Goal:** Create influencer with ComfyUI, lock identity, always use it in generations.

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| 1.1 Add `reference_image_url` to influencers | 🔴 Not Started | - | Migration needed |
| 1.2 Create `/create/influencer` wizard | 🔴 Not Started | - | Marketing page exists at `/create` |
| 1.3 ComfyUI workflow for "identity base" | 🔴 Not Started | - | Reuse existing txt2img templates |
| 1.4 Inject influencer identity in worker | 🔴 Not Started | - | Modify `processGeneration` |
| 1.5 Workflow templates with placeholders | 🔴 Not Started | - | Add `{{lora_path}}`, `{{reference_image}}` |

**Dependencies:**
- Database migration for `reference_image_url` column
- `/create/influencer` route implementation
- Worker pipeline updates for identity injection

---

## Phase 2: Planner ↔ Influencer & Media Type

**Goal:** Planner uses locked influencer; content items specify image vs video.

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| 2.1 Planner "select influencer" step | 🔴 Not Started | - | UI step before/during chat |
| 2.2 Extend `planner_content_items` | 🔴 Not Started | - | Add `media_type` column |
| 2.3 LLM calendar prompt with media_type | 🔴 Not Started | - | Update `MASTER_ASSISTANT_SYSTEM` |
| 2.4 queuePlannerToScheduler mapping | 🔴 Not Started | - | Map `media_type` → workflow slug |

**Dependencies:**
- Phase 1 completion (influencer identity)
- Database migration for `media_type`
- LLM prompt engineering

---

## Phase 3: Auto-Generation Pipeline

**Goal:** Content items trigger image/video generation with influencer identity.

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| 3.1 Content item → generation job | 🔴 Not Started | - | Create `content_v2` on planner queue |
| 3.2 Worker passes influencer_id | 🔴 Not Started | - | `processSafeImageV2` loads creator |
| 3.3 Prompt from content item | 🔴 Not Started | - | Use `prompt_seed` + `hook` + `caption_direction` |

**Dependencies:**
- Phase 1 completion (identity injection)
- Phase 2 completion (media type selection)
- Worker queue updates

---

## Phase 4: Platform Expansion & NSFW Gate Wall

**Goal:** More platforms; clear 18+ gate before NSFW.

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| 4.1 Platform adapters | 🟡 Partial | - | ✅ Instagram/Facebook live; 🔴 TikTok/YouTube/OnlyFans stubbed |
| 4.2 Pre-NSFW gate | 🟡 Partial | - | ✅ Age verification exists; 🔴 No pre-access wall for vault/planner NSFW |
| 4.3 Planner NSFW branch | 🔴 Not Started | - | Block calendar generation if not verified |

**Current Implementation:**
- ✅ `PLATFORM_POLICY` defines integration status (live/stub/planned)
- ✅ `/api/age-gate` endpoint for verification
- ✅ `blueprint_users.age_verified_at` field
- ✅ NSFW gating in `publishScheduledContent`

**Remaining Work:**
- Implement TikTok, YouTube, OnlyFans adapters
- Add middleware/layout-level gate before NSFW routes
- Planner NSFW verification check

---

## Schema Migrations Required

```sql
-- Phase 1: Identity persistence
alter table influencers 
  add column if not exists reference_image_url text,
  add column if not exists reference_image_storage_key text;

-- Phase 2: Media type for content items
alter table planner_content_items 
  add column if not exists media_type text 
  check (media_type in ('image','video'));
```

---

## File Touchpoints

| Purpose | Files | Phase |
|---------|-------|-------|
| Influencer creation UI | `src/app/(dashboard)/create/influencer/` (new) | 1 |
| Worker identity injection | `server/worker/processors/processGeneration.ts` | 1 |
| Planner + influencer | `src/app/(dashboard)/planner/page.tsx` | 2 |
| Queue planner → content | `src/lib/automation/queuePlannerToScheduler.ts` | 2, 3 |
| Content generation | `server/worker/processors/processSafeImageV2.ts` | 3 |
| Platform adapters | `src/lib/social/adapters/` | 4 |
| Age gate middleware | `src/middleware.ts` or layout level | 4 |

---

## Recommended Next Actions

1. **Database migrations** - Run Phase 1 & 2 schema changes
2. **Phase 1.1 + 1.2** - Add `reference_image_url` and create influencer wizard at `/creators/new`
3. **Phase 1.4** - Update worker to inject influencer identity
4. **Phase 2.1** - Add influencer selector to planner chat
5. **Phase 4.1** - Implement priority platform adapter (TikTok or OnlyFans)

---

## Tracking Checklist

- [ ] Phase 1.1: `reference_image_url` migration
- [ ] Phase 1.2: `/creators/new` wizard route
- [ ] Phase 1.3: Identity generation workflow
- [ ] Phase 1.4: Worker identity injection
- [ ] Phase 1.5: Workflow template placeholders
- [ ] Phase 2.1: Planner influencer selection
- [ ] Phase 2.2: `media_type` migration
- [ ] Phase 2.3: LLM prompt with media_type
- [ ] Phase 2.4: queuePlannerToScheduler media mapping
- [ ] Phase 3.1: Content item → generation job
- [ ] Phase 3.2: Worker influencer_id handling
- [ ] Phase 3.3: Prompt assembly from content item
- [ ] Phase 4.1: TikTok adapter
- [ ] Phase 4.1: YouTube adapter
- [ ] Phase 4.1: OnlyFans adapter
- [ ] Phase 4.2: Pre-NSFW gate middleware
- [ ] Phase 4.3: Planner NSFW verification
