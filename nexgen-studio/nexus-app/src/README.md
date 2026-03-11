# nexgen-studio/nexus-app/src — Source overview

This document explains the main source directories and where to find things.

Main directories

- `app/` — Next.js app routes and pages (uses app router). Look here for `layout.tsx`, `page.tsx`.
- `components/` — Reusable React components (UI building blocks).
- `server/worker/` — Worker code (background processing).
- `supabase/` — Supabase migrations and related utilities.
- `tools/` — app-level helper scripts and tools.

Finding features

- Feature folders (e.g. `dashboard`, `influencers`, `models`) usually live under `app/` and contain route-specific code.
- Global helpers and shared types are under `lib/` and `types/`.
