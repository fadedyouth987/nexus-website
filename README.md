# Jobryn — AI Revenue Operating System

Jobryn is the canonical SaaS project for service businesses: capture enquiries, respond quickly, manage customers and jobs, quote, invoice, take payments, automate follow-up, collect reviews, and measure attributed revenue.

## Canonical project rule

This repository is **Jobryn only**. Campaign/Launchpad, Nexus, Vantory prototypes, and other projects are separate and must not be merged into this codebase unless an explicit migration is approved.

- Source of truth: this repository
- Production branch: `main`
- Cloudflare project/Worker name: `jobryn`
- Production domain: `jobryn.org`
- Database: Supabase Postgres
- Billing: Stripe

See [`PROJECT_STATE.md`](./PROJECT_STATE.md) before making changes.

## Stack

- React 19 + TypeScript + Vite
- Node/Express API
- Supabase Auth + Postgres + RLS
- Stripe subscriptions and webhooks
- Cloudflare for DNS/static deployment and edge infrastructure

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm run security:check
npm run build
```

## Deployment

1. Push changes to `main`.
2. Cloudflare deploys from this repository.
3. Do not manually deploy a different local folder as Jobryn production.

See [`CLOUDFLARE_DEPLOY.md`](./CLOUDFLARE_DEPLOY.md) and [`PRODUCTION_SETUP.md`](./PRODUCTION_SETUP.md).
