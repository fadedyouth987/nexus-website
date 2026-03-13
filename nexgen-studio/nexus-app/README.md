# Nexus Website

AI influencer creation and automation platform.

## Overview

Nexus Studio is an AI creator platform. Users create AI influencers, generate images and videos in Studio, plan content, manage assets, and run automation workflows.

## Tech Stack

- Next.js 16.1.6 with React 19
- Tailwind CSS 4.x
- NextAuth.js 4.x
- Supabase
- Stripe
- ComfyUI on RunPod
- Vercel for app hosting
- Cloudflare for DNS/CDN if desired

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Supabase account
- Vercel account
- RunPod ComfyUI endpoint

### Installation

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

### Core Environment Variables

Create `.env.local` with the app secrets you need. At minimum:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=your_stripe_publishable_key

# RunPod / ComfyUI
COMFYUI_BASE_URL=https://your-runpod-comfyui-endpoint
COMFY_SFW_URL=https://your-runpod-comfyui-endpoint
COMFY_NSFW_URL=https://your-runpod-comfyui-endpoint
COMFY_VIEW_PATH=/view
```

## Vercel Deployment

### 1. Create the Vercel project

1. Import the GitHub repository into [Vercel](https://vercel.com/new).
2. Set the production branch to `main`.
3. Add `nexgencompany.org` as the production domain in Vercel.
4. If you keep the domain on Cloudflare, point Cloudflare DNS to Vercel.

### 2. Set Vercel environment variables

Add the same runtime secrets from `.env.local` to the Vercel project.

Required for the web app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`

Required if the corresponding features are enabled:

- `OPENAI_API_KEY` or `OPENROUTER_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
- `STRIPE_PRICE_TIER1_MONTHLY`
- `STRIPE_PRICE_TIER1_YEARLY`
- `STRIPE_PRICE_TIER2_MONTHLY`
- `STRIPE_PRICE_TIER2_YEARLY`
- `STRIPE_PRICE_TIER3_MONTHLY`
- `STRIPE_PRICE_TIER3_YEARLY`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`
- `STRIPE_PRICE_ENTERPRISE_YEARLY`
- `REDIS_URL`
- `COMFYUI_BASE_URL`
- `COMFY_SFW_URL`
- `COMFY_NSFW_URL`
- `COMFY_VIEW_PATH`
- `COMFYUI_OUTPUT_BUCKET`
- `V2_GENERATED_BUCKET`
- `RUNPOD_API_KEY`
- `RUNPOD_ENDPOINT_ID`
- `SOCIAL_TOKEN_ENCRYPTION_KEY`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `SMS_OTP_PEPPER`
- `SMS_PROVIDER_URL`
- `SMS_PROVIDER_API_KEY`
- `SMS_SENDER_ID`
- `ADMIN_USER_IDS`
- `ENABLE_V2_PORTFOLIO`
- `NEXT_PUBLIC_ENABLE_V2_PORTFOLIO`

### 3. GitHub Actions deployment automation

The workflow in [`.github/workflows/deploy-vercel.yml`](/C:/Users/nexge/New%20folder/nexgen-studio/nexgen-studio/nexus-app/.github/workflows/deploy-vercel.yml) automates:

- preview deployments for pull requests
- production deployments for pushes to `main` or `master`

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The `VERCEL_PROJECT_ID` must belong to the Vercel project that owns `nexgencompany.org`. The production workflow now runs a live domain check after deploy and will fail if the custom domain serves some other app.

### 4. Manual deployment

```bash
npm install -g vercel
vercel link
vercel
vercel --prod
```

### 5. Pre-deploy verification

Run the local deploy gate before shipping:

```bash
pnpm verify:deploy
```

This runs typecheck, lint, tests, and a production build in sequence.

## Project Structure

```text
src/
  app/           Next.js App Router routes and API handlers
  components/    UI and layout components
  context/       React contexts
  hooks/         Custom hooks
  lib/           Shared library code
server/
  worker/        Background worker code
public/
  landing/       Landing page media
  app/           In-app generated media
```

## Useful Scripts

- `pnpm dev` - start local development server
- `pnpm build` - build the Next.js app
- `pnpm typecheck` - run TypeScript checks
- `pnpm lint` - run ESLint
- `pnpm verify:domain` - verify that `nexgencompany.org` resolves and serves this app
- `pnpm cf:build` - build Cloudflare/OpenNext output

## Notes

- The Vercel path is the recommended production deployment target for this repo.
- Cloudflare Workers deployment is currently a poor fit for this app because the Worker bundle exceeds free-plan size limits.
- RunPod generation requires the ComfyUI endpoint to be healthy. If the RunPod URL returns `502`, generation will fail even if the frontend is deployed.
- On Windows PowerShell with strict execution policy, use `pnpm.cmd` instead of `pnpm` for local command execution.
