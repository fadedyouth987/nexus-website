# Docker hybrid stack

End-to-end **auth, org, generation, and proxy** behavior is described in [application-flow.md](./application-flow.md). Agent onboarding: [AGENT_HANDOFF.md](./AGENT_HANDOFF.md).

This repo ships a **hybrid** layout:

- **Schema & auth**: use [Supabase](https://supabase.com/) (`supabase start` locally or a hosted project). Apply migrations with the Supabase CLI (`supabase db reset` / `supabase migration up`). Do **not** mount `supabase/migrations` into a raw Postgres container unless you intentionally bypass Supabase tooling.
- **Compose** (`docker-compose.yml`): **Redis**, **MinIO**, **Next.js (`web`)**, **BullMQ worker**, and **WebSocket gateway**. Optional **`postgres`** service is behind profile `local-db` for experiments only.
- **ComfyUI** is behind profile **`gpu`** (NVIDIA). On Windows/macOS without GPU, omit the profile and run ComfyUI elsewhere, pointing `COMFYUI_URL` at it (defaults try `host.docker.internal:8188`).

## Quick start

1. Copy `.env.example` to `.env` and fill Supabase + `NEXTAUTH_SECRET`.
2. Start Supabase locally and apply migrations.
3. `docker compose up --build` (add `--profile gpu` only if you have an NVIDIA runtime and want the bundled ComfyUI image).

## Ports

| Service    | Port |
|-----------|------|
| Next app  | 3000 |
| WebSocket | 3002 |
| Redis (host → container) | **6380** → 6379 |
| MinIO API | 9000 |
| MinIO UI  | 9001 |

Set `NEXT_PUBLIC_WS_URL` (e.g. `ws://localhost:3002`) for browser clients that subscribe with `?jobId=`.
