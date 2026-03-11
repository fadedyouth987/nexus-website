# Nexgen Studio — application folder

This folder holds the primary application code (Next.js) and supporting services.

Top-level folders

- `src/` — application source (pages, components, features).
- `worker/` — background workers and processing pipelines.
- `scripts/` — helper scripts used for OpenClaw integration and other tooling.
- `infra/` — docker / infrastructure definitions for local testing.

Common tasks

- Start dev web server: `npm run dev` (run in this folder).
- Start worker in separate terminal: `npm run dev:worker`.

Notes

- Many UI files live under `src/app/` and `src/components/`. Look for `src/app/layout.tsx` as the root page layout.
