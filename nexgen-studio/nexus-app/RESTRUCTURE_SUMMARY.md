# Restructure Summary

## Old structure problems

- `src/app` mixed marketing pages, authenticated product pages, admin tools, and API routes in one flat tree.
- Many section folders carried one-line `layout.tsx` files that only wrapped the same shell.
- The main authenticated shell lived in `src/app/main-layout.tsx`, which made a reusable layout concern look like a route concern.
- Studio generation UI lived beside the route file, so generation-related components were harder to discover and reuse.
- Admin pages repeated the same loading, error, page-title, and table-shell patterns.
- Marketing pages had no shared public structure or footer pattern, which made public UX feel less consistent.

## New structure overview

- `src/app/(marketing)` now contains public/marketing routes such as landing, pricing, auth, legal, onboarding, and support pages.
- `src/app/(dashboard)` now contains logged-in product routes such as dashboard, creators, studio, gallery, automation, planning, and settings.
- `src/app/(admin)` now contains the admin console routes.
- `src/app/api` was left in place so API behavior and route URLs remain intact.
- The canonical rebuilt API surface for the new route-group/module architecture is the additive SaaS set under `src/app/api` such as `projects`, `brand-kits`, `campaigns`, `scheduled-content-runs`, `video-jobs`, and `assets`; older endpoints remain for compatibility during migration.
- `src/components/layout/AppShell.tsx` is now the shared authenticated shell for app and admin experiences.
- `src/components/generation/studio` now contains studio-specific generation components.
- `src/components/admin` now contains reusable admin page scaffolding.
- `src/components/marketing` now contains shared marketing UI, starting with the shared footer.

## Key files moved

- Public routes moved from `src/app/*` into `src/app/(marketing)/*`.
- Product routes moved from `src/app/*` into `src/app/(dashboard)/*`.
- Admin routes moved from `src/app/admin/*` into `src/app/(admin)/admin/*`.
- Studio helper components moved from `src/app/(dashboard)/studio/*` into `src/components/generation/studio/*`.
- The old `src/app/main-layout.tsx` was replaced by `src/components/layout/AppShell.tsx`.

## Components created or merged

- Created `src/components/layout/AppShell.tsx`.
- Created `src/components/admin/AdminPageShell.tsx`.
- Created `src/components/marketing/MarketingFooter.tsx`.
- Replaced many duplicated section layouts with:
  - `src/app/(dashboard)/layout.tsx`
  - `src/app/(marketing)/layout.tsx`
  - `src/app/(admin)/layout.tsx`
- Updated admin pages to use shared admin scaffolding instead of repeating container/loading/error shells.
- Updated marketing landing/pricing pages to share a common footer pattern.

## What changed in behavior

- URLs were preserved by using App Router route groups rather than renaming route paths.
- Public pages such as `contact` and `learn` now sit under the marketing grouping instead of inheriting the app shell.
- Admin pages now render inside a dedicated admin shell layered on top of the shared app shell.

## Validation

- `pnpm.cmd typecheck` passed.
- `pnpm.cmd lint` passed.
- `pnpm.cmd build` passed.

## Manual review still recommended

- Review remaining lint warnings around React hook dependencies and `<img>` usage in legacy pages.
- Review the admin console UX to decide whether action buttons should stay optimistic-only or be wired to real mutations.
- Review the marketing/public nav story if you want a persistent public header beyond the current page-specific layouts.
- Review whether additional route-local components under other product areas should also be moved into feature component folders (`dashboard`, `planner`, `gallery`, `billing`).
- Review the Vercel/domain automation changes already present in this branch together with this restructure before shipping.
