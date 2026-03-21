# Blueprint Execution Layer Dev

## 1. Apply SQL migrations

Run these in Supabase SQL Editor:

- `supabase/migrations/0001_blueprint_exec_layer.sql`
- `supabase/migrations/000201_no_dup_constraints.sql`
- `supabase/migrations/0003_v2_agency_tables.sql`
- `supabase/migrations/0004_v2_agency_functions.sql`
- `supabase/migrations/0005_v2_agency_rls.sql`
- `supabase/migrations/0006_v2_rbac_hardening.sql`
- `supabase/migrations/0007_ai_influencer_os.sql`
- `supabase/migrations/20260305_models_and_verification.sql`
- `supabase/migrations/20260306_billing_gpu_jobs.sql`

## 2. Configure environment

Copy:

- `.env.local.template` -> `.env.local`

Then replace only the `__REPLACE_ME__` values.

Optional helper commands:

```bash
npm run supabase:check
npm run supabase:check:ping
```

To set Supabase keys directly:

```bash
npm run supabase:configure -- -ProjectUrl "https://<project-ref>.supabase.co" -AnonKey "<anon-key>" -ServiceRoleKey "<service-role-key>"
```

## 3. Start Redis

```bash
docker compose -f infra/docker-compose.yml up -d redis
```

## 4. Install packages

```bash
npm install
```

## 5. Start the web app

```bash
npm run dev:web
```

## 6. Start the worker

```bash
npm run dev:worker
```

## 7. Test the queue path

Create a generation:

```bash
curl -X POST http://localhost:3000/api/generate ^
  -H "Content-Type: application/json" ^
  -H "Cookie: __AUTH_COOKIE__" ^
  -d "{\"influencerId\":\"__INFLUENCER_ID__\",\"workflowTemplateId\":\"__WORKFLOW_TEMPLATE_ID__\",\"mode\":\"IMAGE\",\"inputs\":{\"prompt\":\"test prompt\"}}"
```

Watch SSE:

```bash
curl -N http://localhost:3000/api/generate/__JOB_ID__/events ^
  -H "Cookie: __AUTH_COOKIE__"
```

## 8. Confirm no duplicate assets

This query must return zero rows:

```sql
select generation_job_id, kind, asset_variant, count(*) as row_count
from public.generated_assets
group by generation_job_id, kind, asset_variant
having count(*) > 1;
```

## 9. Studio Models + Runpod env vars

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXTAUTH_SECRET`
- `RUNPOD_API_KEY`
- `SMS_PROVIDER_URL`
- `SMS_PROVIDER_API_KEY`

Recommended for Runpod prototype:

- `RUNPOD_API_BASE_URL` (default: `https://api.runpod.io/v2`)
- `RUNPOD_CONTAINER_IMAGE`
- `RUNPOD_GPU_TYPE` (default: `A100-80GB`)
- `RUNPOD_BILLING_TYPE` (default: `spot`)
- `RUNPOD_REGION`
- `RUNPOD_MAX_RUNTIME_MS`
- `RUNPOD_POLL_INTERVAL_MS`
- `RUNPOD_RESULT_CALLBACK`
- `MODEL_VALIDATION_BUCKET` (default: `models-validation`)
- `RUNPOD_EST_RUNTIME_SECONDS`

Verification and OTP hooks:

- `SMS_SENDER_ID`
- `SMS_OTP_PEPPER`
- `VERIFICATION_PROVIDER_URL` (placeholder)
- `VERIFICATION_PROVIDER_KEY` (placeholder)

Billing hooks (placeholders):

- `BILLING_PROVIDER_URL`
- `BILLING_PROVIDER_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

AUD pricing baseline used by GPU estimator:

- `A100 hour = 220 credits` (1 credit = AUD 0.01)
- `10% reserve overhead`
- Tiers: Starter (AUD 49), Pro (AUD 279), Scale (AUD 1,099), Enterprise (custom)

## 10. Staging deployment checklist

1. Apply migrations in order through `20260306_billing_gpu_jobs.sql`.
2. Create storage buckets: `models`, `models-nsfw`, and `models-validation`.
3. Set all required env vars from section 9 in staging.
4. Provision Twilio sandbox and set `SMS_PROVIDER_URL` + `SMS_PROVIDER_API_KEY` + `SMS_SENDER_ID`.
5. Start staging web + worker (`npm run dev:web`, `npm run dev:worker` or deployment equivalent).
6. Validate Level 1 OTP send/verify and NSFW signed URL gating in staging before production rollout.
