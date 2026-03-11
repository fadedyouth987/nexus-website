# Supabase migrations

**Project:** `https://yuwgccxezqarbiwrqzzv.supabase.co` — run migrations in this project’s SQL Editor (or set it as your linked project for `supabase db push`).

When running SQL in the Supabase SQL Editor (or via `supabase db push`), use this order to avoid errors:

1. **20260305_models_and_verification.sql** – Creates `models`, `user_verifications`, `sms_otp_codes`, `subscription_tiers_aud`, and defines `blueprint_set_updated_at` if missing.
2. **20260306_billing_gpu_jobs.sql** – Creates `model_gpu_jobs` (depends on `public.models`) and credit functions. Requires `public.models` and, for the credit functions to work, `public.credit_ledger` (from `0001_blueprint_exec_layer.sql` if you use it).
3. **20260306_llm_persona_fields.sql** – Adds persona columns to `influencers` and creates `engagement_logs` only if `public.influencers` exists.
4. **20260307_social_connector.sql** – Creates `social_accounts`, `publish_jobs`, `webhook_events`, `analytics_snapshots`. Requires `auth.users` (Supabase Auth).

**If you see errors:**

- **"function public.blueprint_set_updated_at() does not exist"** – Run `20260305_models_and_verification.sql` first (it now defines this function).
- **"relation public.models does not exist"** – Run `20260305_models_and_verification.sql` before `20260306_billing_gpu_jobs.sql`.
- **"relation public.credit_ledger does not exist"** – The billing migration’s functions use `credit_ledger`; that table is created in `0001_blueprint_exec_layer.sql`. Either run 0001 first or ignore the billing migration until your schema includes `credit_ledger`.
- **"relation public.influencers does not exist"** – The LLM migration only alters `influencers` and creates `engagement_logs` when `influencers` exists; it will no-op if the table is missing.
