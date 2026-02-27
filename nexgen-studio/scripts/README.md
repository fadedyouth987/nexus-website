# Scripts

Utility scripts for local startup, seeding, and migration generation.

- `dev-start.sh`: one-command local startup (normalizes backend DB URL, runs migrations, frees ports 8000/3000, starts backend + frontend, writes logs to `/tmp/ai_influencer_backend.log` and `/tmp/ai_influencer_frontend.log`).
- `supabase-doctor.sh`: checks Supabase DNS/TCP connectivity, runs migrations, and runs backend schema repair to diagnose/fix common Supabase startup issues.
- `production-doctor.sh`: validates production env config, Supabase reachability, and optional Cloudflare DNS/Auth configuration checks.
- `prod-env-sync.sh`: writes production frontend/backend env values from `APP_DOMAIN` and optional `API_DOMAIN`, and aligns Supabase env values across app layers.
- `apply-production-config.sh`: upserts Cloudflare DNS records and patches Supabase Auth URL config in a single command.
- `reset-cloudflare-dns.sh`: removes conflicting `@/www/api` web records and recreates clean CNAME routing for frontend/backend targets.
- `render-doctor.sh`: validates that a Render backend URL is actually serving this FastAPI app and prints direct fix instructions for common misconfigurations.
- `generate-migrations.sh "message"`: creates an Alembic autogeneration revision from current backend models.
- `configure-supabase-google-auth.sh`: enables Google OAuth provider in Supabase via Management API (requires `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
