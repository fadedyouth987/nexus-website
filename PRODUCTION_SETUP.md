# Jobryn Production Setup

This document covers the production services Jobryn expects. Keep real secrets out of GitHub.

## 1. Supabase

Create one production Supabase project for Jobryn and apply migrations in order:

1. `supabase/migrations/0001_jobryn_core.sql`
2. `supabase/migrations/0002_saas_roles_and_plans.sql`
3. `supabase/migrations/0003_revenue_os_core.sql`
4. `supabase/migrations/0004_subscription_and_tenant_invariants.sql`
5. `supabase/migrations/0005_least_privilege_rbac.sql`
6. `supabase/migrations/0006_usage_metering.sql`

Configure Supabase Auth redirect URLs for the production Jobryn domain and local development.

## 2. Stripe

Create recurring prices for Starter, Growth, and Operator. Store the price IDs and Stripe secrets only in the production environment. Configure the webhook endpoint used by the Jobryn API and verify signatures.

## 3. Environment variables

Copy `.env.example` locally for development. Never commit `.env`. Production secrets belong in the relevant provider secret store.

## 4. Cloudflare

Cloudflare must deploy from the canonical GitHub `main` branch. Do not use Direct Upload for normal Jobryn production releases because it can drift away from GitHub.

## 5. Release gate

Before production deployment, run:

```bash
npm run typecheck
npm run security:check
npm run build
```

Then confirm the deployed Cloudflare build references the same Git commit currently at GitHub `main`.
