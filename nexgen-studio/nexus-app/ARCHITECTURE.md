# Architecture

## Domain Boundaries

- `src/app/(marketing)`: public marketing, waitlist, and authentication entry pages.
- `src/app/(dashboard)`: authenticated product UI for dashboard, projects, brand kits, campaigns, video jobs, assets, billing, and settings.
- `src/app/(admin)`: isolated admin UI.
- `src/app/api/*`: thin request handlers only.
- `src/modules/projects`: project domain types, validation, repository, and service.
- `src/modules/brand-kits`: reusable brand system records for campaigns and generation.
- `src/modules/campaigns`: campaign briefs and orchestration inputs.
- `src/modules/video-jobs`: async video job lifecycle, mapping, and orchestration.
- `src/modules/assets`: generated asset listing logic.
- `src/modules/usage-events`: durable usage/accounting events and generation operations metrics.
- `src/modules/scheduling`: recurring content schedules, execution history, and durable job fan-out.
- `src/server/auth`: authenticated server session and org resolution.
- `src/server/supabase`: service-role Supabase access and DB error helpers.
- `src/server/providers`: provider interfaces and queue adapter boundaries.

## Route Structure

- Marketing routes stay under `src/app/(marketing)`.
- Product routes live under `src/app/(dashboard)` and are organized around the SaaS workflow:
  - `/dashboard`
  - `/projects`
  - `/brand-kits`
  - `/campaigns`
  - `/video-jobs`
  - `/assets`
  - `/billing`
  - `/settings`
- Admin routes remain isolated under `src/app/(admin)/admin`.

## Request Flow

1. Route handler validates input with Zod.
2. Route handler resolves the authenticated user and organization via `requireAppSession`.
3. Route handler calls a module service.
4. Service coordinates repository access and provider interactions.
5. Repository performs Supabase reads/writes with the service-role server client.
6. Response returns typed JSON without embedding DB logic in the route file.

## Job Flow

1. User creates a campaign brief and submits a durable generation job.
2. `POST /api/video-jobs` creates a `video_jobs` row immediately.
3. `video_jobs` now carry a minimal `job_kind` (`video` or `image`) so the same durable operational model can back both Studio media flows.
4. The `video:jobs` worker loads the job, resolves campaign/project/brand-kit context, and creates the underlying blueprint `generation_jobs` row when `workflowTemplateId` and `influencerId` metadata are present.
5. The worker selects blueprint mode from `job_kind`, so image and video both reuse the real existing generation backbone.
6. Existing generation workers continue processing the real generation workload.
7. The `video:jobs` worker re-checks the linked generation job until it reaches a terminal state and mirrors lifecycle/progress back into `video_jobs`.
8. `video_jobs` now support `retry`, explicit `cancelled` state, lifecycle timestamps, and best-effort upstream cancellation by marking linked `generation_jobs` as `CANCELED`.
9. `POST /api/video-jobs/[id]/duplicate` creates a fresh durable job from the prior job context, while `POST /api/video-jobs/[id]/retry` only re-enqueues the same failed record.
10. `GET /api/video-jobs/[id]` synchronizes the SaaS job lifecycle from the underlying generation status and returns linked assets.
11. Durable lifecycle transitions now emit idempotent `usage_events` keyed by durable job attempt for queueing, retries, credit reservation, completion, failure, cancellation, and credit release.
12. `credit_ledger` remains the source of truth for actual credit balance mutations, while `usage_events` is the shared accounting and analytics read model for image and video jobs.
13. `scheduled_content_runs` defines recurring daily or weekly generation rules, and `scheduled_content_run_executions` records each durable execution attempt.
14. The worker interval scans due `scheduled_content_runs`, claims them idempotently, creates one or more durable `video_jobs`, and records execution history without bypassing the existing job/accounting backbone.

## Current Default Generation Path

- Dashboard create/edit forms now exist for:
  - projects
  - brand kits
  - campaigns
  - generation jobs
- The Studio image and video submission paths now create source records in the new domain model and submit through `video_jobs`.
- New Studio generation should flow through `project -> campaign -> durable generation job`.

## Provider Adapter Locations

- Queue provider interface: `src/server/providers/types.ts`
- BullMQ queue adapter: `src/server/providers/queue/bullmqQueueProvider.ts`
- Existing media generation/provider-specific code remains in:
  - `src/lib/comfyui/*`
  - `src/lib/llm/*`
  - `server/worker/*`

These are intentionally behind services now, so page components do not call vendor-specific logic directly.

## Scheduling And Future Automation

- `scheduled_content_runs` is introduced in the migration as the future recurring execution anchor.
- Future automation should create or update:
  - `campaigns`
  - `video_jobs`
  - `scheduled_content_runs`
  - `usage_events`
- Queue backends can be swapped by replacing the `QueueProvider` implementation without rewriting route handlers or product pages.
- Future review or publishing layers should attach to `scheduled_content_run_executions` and the generated `video_jobs` rather than inventing a second scheduler.

## Migration Strategy

- Existing migrations remain intact.
- `20260313_saas_foundation.sql` adds the new SaaS entities on top of the current organization model.
- Existing `generation_jobs` and `generated_assets` tables remain the execution and output backbone during the migration period.
- `20260313_usage_event_accounting.sql` extends `usage_events` so durable image/video jobs can share one operational accounting stream without changing the underlying credit ledger.
- `20260313_scheduled_content_automation.sql` extends the placeholder `scheduled_content_runs` table, adds `scheduled_content_run_executions`, and links recurring runs back to durable `video_jobs`.
- New product routes and APIs use additive tables rather than destructive table replacement.
