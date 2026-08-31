# Jobryn — Cloudflare Deployment

## Rule: GitHub is the source of truth

Jobryn production must deploy from the canonical GitHub `main` branch. Avoid Direct Upload and avoid deploying from random local folders.

## Cloudflare project identity

- Project/Worker name: `jobryn`
- Production branch: `main`
- Domain: `jobryn.org`
- Wrangler name: `jobryn`

## Connect once

In Cloudflare **Workers & Pages**, connect the canonical Jobryn GitHub repository and select `main` as the production branch. Configure the frontend build as:

- Build command: `npm run build`
- Static output directory: `dist`
- Node version: 22

The current repository contains a Node/Express API as well as the SPA. If the API is hosted separately, configure the frontend API origin accordingly. Do not assume a Pages static deployment automatically runs the Express server.

## Normal release flow

1. Change Jobryn in the canonical repository.
2. Run verification.
3. Commit/push to `main`.
4. Let Cloudflare build from that commit.
5. Verify the deployment commit matches GitHub `main`.

## Never do this

- Do not deploy an old ZIP directly to the production Jobryn project.
- Do not connect Launchpad, Campaign, Nexus, or another repo to the Jobryn production project.
- Do not make production-only edits in a Cloudflare editor that are not committed back to GitHub.
