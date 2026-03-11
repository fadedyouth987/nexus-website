# Nexus Website

AI Influencer Creation & Automation Platform

## Overview

Nexus Studio is an AI influencer creation platform. Users create AI influencers, generate images and videos in Studio, plan content in the content planner, and publish or manage assets in Gallery and Vault.

## Features

- **Creation**: Photoreal images, talking-head video, style and character presets
- **Automation**: Content, scheduling, engagement, and monetization in one OS
- **Growth**: Analytics, A/B testing, multi-platform scheduling, and 30-day autopilot

## Tech Stack

- **Framework**: Next.js 16.1.6 with React 19
- **Styling**: Tailwind CSS 4.x
- **Auth**: NextAuth.js 4.x
- **Database**: Supabase
- **Payment**: Stripe
- **AI/ML**: ComfyUI integration for image/video generation
- **Deployment**: Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm or npm
- Supabase account
- Cloudflare account

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

### Environment Variables

Create `.env.local` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable

# ComfyUI
COMFY_API_URL=your_comfyui_endpoint
COMFY_API_KEY=your_comfyui_key

# Cloudflare (for deployment)
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

## Deployment to Cloudflare Pages

### 1. Create Cloudflare Pages Project

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Set build command: `npm run build`
5. Set output directory: `dist`

### 2. Set Environment Variables in Cloudflare

In your Cloudflare Pages project settings, add these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (set to your production domain)
- All other required secrets from `.env.local`

### 3. Automatic Deployment

The GitHub Actions workflow in `.github/workflows/deploy-cloudflare.yml` automatically deploys on every push to `main`.

### Manual Deployment with Wrangler

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages deploy dist --project-name=nexus-website
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── (routes)/          # Page routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # UI primitives
│   ├── layout/           # Layout components
│   └── onboarding/       # Onboarding components
├── lib/                   # Library code
│   ├── automation/       # Automation pipeline
│   ├── workflow/         # Workflow builder
│   ├── planner/          # Content planner
│   └── social/           # Social platform integration
├── context/              # React contexts
├── hooks/                # Custom hooks
└── types/                # TypeScript types
```

## Key Features

### AI Influencer Factory (`/automation/factory`)

One-click setup that creates:
- Creator persona
- 30-day strategy/calendar
- Scheduler queue
- Monetization offer draft

### Content Pipeline

Modular pipeline system with steps:
1. Create Creator
2. Create Plan
3. Generate Brief
4. Generate Strategy
5. Generate Calendar
6. Queue to Scheduler
7. Create Monetization

### Social Platform Matrix

| Platform | Integration | SFW | NSFW |
|----------|-------------|-----|------|
| Instagram | Live | Yes | No |
| Facebook | Live | Yes | No |
| TikTok | Stub | Yes | No |
| X (Twitter) | Stub | Yes | Yes |
| YouTube | Stub | Yes | No |
| LinkedIn | Stub | Yes | No |
| Pinterest | Stub | Yes | No |
| Reddit | Stub | Yes | Yes |
| Threads | Planned | Yes | No |
| Snapchat | Planned | Yes | No |
| OnlyFans | Planned | Yes | Yes |
| Fansly | Planned | Yes | Yes |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run typecheck` - Run TypeScript checks
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

Private - All rights reserved

## Support

For support, contact [your-email@example.com] or open an issue in this repository.
