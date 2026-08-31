# Jobryn — Project State

## Identity

- Project: **Jobryn**
- Domain: **jobryn.org**
- Production branch: **main**
- Cloudflare deployment name: **jobryn**
- Database: **Supabase**
- Billing: **Stripe**

## Source of truth

The `main` branch of this repository is the only canonical Jobryn source tree.

## Non-negotiable separation

The following are separate projects and must not be copied, merged, or reintroduced into Jobryn by default:

- Campaign / Campaign OS
- Launchpad.ai
- Nexus / Nexus.OS / historical Nexus code
- Other unrelated prototypes

If old code is useful, migrate only the specific capability after confirming it belongs to Jobryn. Never wholesale-merge an old project.

## Change flow

`edit -> verify -> commit to main -> Cloudflare build/deploy`

Do not treat a random laptop folder, ZIP, Cloudflare editor copy, or old chat attachment as newer than `main` unless it is deliberately imported and committed.

## Before changing Jobryn

1. Read this file.
2. Confirm the repo and branch are this Jobryn `main`.
3. Check `git status` and `git remote -v`.
4. Make the change.
5. Run the available verification commands.
6. Commit/push to `main`.
7. Verify Cloudflare deployed that commit.

## Historical safety copy

The pre-Jobryn Nexus tree is preserved on branch `archive/nexus-before-jobryn-2026-08-31`. Do not use that branch for Jobryn development or deployment.
