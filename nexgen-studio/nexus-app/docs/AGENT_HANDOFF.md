# Agent handoff — nexus-app

End-to-end context for another agent working in this repo. **Canonical flow detail** lives in [application-flow.md](./application-flow.md); this file adds topology, file map, and operational notes.

## 1. What this project is

- **Next.js 16** App Router app for an AI studio: org-scoped **image generation** (ComfyUI), **assets**, **billing-ish** tokens/plan, **BullMQ** workers, optional **WebSocket** fan-out, **Supabase** (Postgres + RLS-oriented schema), **NextAuth** for sessions.
- The app root for all commands is the directory containing this `docs/` folder, `package.json`, and `next.config.ts`. The parent monorepo folder may differ on disk.

## 2. Documentation map (read order)

| Doc | Purpose |
|-----|--------|
| [application-flow.md](./application-flow.md) | **Single source of truth**: proxy vs `/api`, org resolution, generation pipeline, billing query, studio hydration, Docker port notes. |
| [docker-stack.md](./docker-stack.md) | Compose services, Supabase vs compose Postgres, published ports (Redis **6380** on host). |
| `.env.example` | Env names and comments (including `REDIS_URL` for compose Redis on **6380**). |

Code pointers to the flow doc: `src/proxy.ts`, `src/lib/api/org.ts`, `src/app/api/ai/generate-image/route.ts`, `src/context/OrganizationContext.tsx`, `src/context/GenerationContext.tsx`.

## 3. Runtime topology

- **Browser** → **Next** (App Router pages + `src/app/api/**` route handlers).
- **Edge gate**: `src/proxy.ts` (Next **Proxy**, successor to `middleware`). **Critical**: **`/api/*` is never redirected for auth**; APIs use `getServerSession(authOptions)` and return JSON status codes.
- **DB**: **Supabase** Postgres. Migrations: `supabase/migrations/` (apply with Supabase CLI per docker-stack.md).
- **Queue**: **BullMQ**, queue name **`generation-jobs`**, Redis from **`REDIS_URL`**. `src/lib/jobs/generationQueue.ts`; consumer `src/workers/index.ts` (`pnpm dev:worker`).
- **ComfyUI**: **`COMFYUI_URL`**; workflow from job `input_params` via `src/lib/ai/comfyui.ts` and `src/lib/ai/txt2imgWorkflow.ts`.
- **Object storage**: S3-compatible (MinIO in compose or cloud); see `.env.example` and `src/lib/storage`.
- **WebSocket**: `src/websocket-server` (`pnpm dev:websocket`); compose exposes **3002**; browsers use `NEXT_PUBLIC_WS_URL`.

## 4. Auth model

- **`src/auth.ts`**: NextAuth **Credentials** uses Supabase Auth (anon Supabase client without persisted browser session in that client). JWT carries user id and Supabase tokens; refresh in callbacks.
- **API routes**: `getServerSession(authOptions)` from `next-auth`.
- **Proxy**: `getToken` from `next-auth/jwt` + **`NEXTAUTH_SECRET`** (must match NextAuth).
- **Handler**: `src/app/api/auth/[...nextauth]/route.ts`.

## 5. App shell and client state

- **`src/app/layout.tsx`**: `SessionProvider` → `OrganizationProvider` → children. **`suppressHydrationWarning`** on `html` and `body` mitigates **browser extension** attribute injection; it does **not** fix incorrect SSR in app components.
- **`OrganizationContext`**: When session is `authenticated`, loads **`GET /api/organizations`**. Active org: **`localStorage`** key **`nexus_active_org_id`**, else first org. Selector updates that key.
- **`GenerationProvider`** (mounted from `src/app/(dashboard)/studio/page.tsx`): Initial state is **always** defaults on server and first client render; **`localStorage`** `generationSettings` is applied in **`useEffect`** after mount to avoid hydration mismatch.

## 6. Org-aware server behavior

- **`src/lib/api/org.ts`**: `resolveGenerationOrgId`, `getPrimaryOrgId`, `getOrgPlanSlug`, `stripGenerationRequestMeta`.
- **`POST /api/ai/generate-image`**: Body **`org_id` / `orgId`** → membership check, or primary org if omitted; usage + tokens; insert **`generation_jobs`**; enqueue. Org keys stripped from persisted **`input_params`**.
- **`GET /api/billing/me`**: Optional **`?org_id=`**; same membership rules; **403** → structured **`billing_failure`** log with **`requestedOrgId`** (raw query), not **`resolvedOrgId`**.
- **`src/workers/processGenerationJob.ts`**: Uses **`job.org_id`** from DB for storage paths and **`generated_assets.org_id`**.

## 7. Route inventory (high level)

- **Pages**: `/`, `/landing`, `/auth`, `/studio`, `/generations/[id]`.
- **APIs** (representative): `api/auth/[...nextauth]`, `api/ai/generate-image`, `api/billing/me`, `api/organizations`, `api/assets`, `api/assets/upload`, `api/assets/[id]/favorite`, `api/models`, `api/workflows`, `api/health`, `api/waitlist`, `api/stripe/webhook`.

## 8. Observability

- **`src/lib/logging/generationFailure.ts`**: JSON lines on stderr; distinguish **`resolvedOrgId`** (authorized tenant) vs **`requestedOrgId`** (forbidden billing query).
- **`src/app/api/health/route.ts`**: Dependency probes; **503** when local stack is degraded (not an auth/proxy signal).

## 9. Env and process startup

- **`src/instrumentation.ts`**: On Node runtime, **`parseCoreEnv()`** in `src/lib/core/env.ts` (Zod; soft in dev when vars missing).
- **Typical local**: `pnpm dev` for Next + `docker compose` for Redis/MinIO; align **`.env.local`** **`REDIS_URL`** with compose (often **`redis://127.0.0.1:6380`**).
- **Full stack in Docker**: `docker compose up --build` — fill Supabase and secrets per compose `environment` blocks.

## 10. Tests

- **Vitest** (`vitest.config.ts`, `pnpm test`). Examples: `src/lib/api/org.test.ts`, `src/app/api/billing/me/route.test.ts`, `src/app/api/waitlist/*.test.ts`.

## 11. Non-goals / confusion traps

- Data access is **Supabase JS**, not Prisma, in this app slice.
- **Proxy** redirect behavior applies to **pages**, not **`/api/*`**.
- **Generation** smoke tests need **Redis + worker + Comfy** healthy; failures may be infra, not org logic.

## 12. Suggested workflow for changes

1. Read [application-flow.md](./application-flow.md).
2. Grep: `resolveGenerationOrgId`, `getPrimaryOrgId`, `stripGenerationRequestMeta`, `proxy` function in `src/proxy.ts`.
3. For hydration: grep **`localStorage`** inside **`useState(`** lazy initializers in `'use client'` components.

---

Update this file when you introduce new subsystems or change cross-cutting contracts (proxy, org, queue, auth).
