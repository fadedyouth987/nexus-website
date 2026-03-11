# Nexgen Studio (monorepo)

This repository contains tools and the Next.js application used by Nexgen Studio.

High-level layout

- `nexgen-studio/` — main application and services (Next.js app, worker, infra, scripts).
- `openclaw-data/` — OpenClaw gateway, credentials, and runtime data.
- `scripts/` — repository-level helper scripts for setup and dev.
- `chat.mjs` — small utility script (see root package.json).

Quick start

1. Open the app folder: `nexgen-studio/nexus-app`.
2. Install dependencies: `npm install` (run inside that folder).
3. Run dev: `npm run dev` or `npm run dev:web`.

Where to look first

- Application entry and Next configuration: `nexgen-studio/nexus-app`.
- Worker and background tasks: `nexgen-studio/nexus-app/worker`.
- Infra and local deployment helpers: `nexgen-studio/nexus-app/infra` and `nexgen-studio/nexus-app/scripts`.

For a concise map of the Next.js app's source tree, see `nexgen-studio/nexus-app/src/README.md`.
