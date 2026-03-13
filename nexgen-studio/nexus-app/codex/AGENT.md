# AGENTS.md

## Mission
Restructure this website into a clean, scalable SaaS codebase for an AI image generation platform powered by ComfyUI workers.

## Product intent
The site is for a subscription-based AI image generation product. It should feel premium, modern, fast, and easy to understand. The current problem is that the site structure is confusing, inconsistent, and hard to maintain.

## Primary goals
- Simplify the information architecture
- Reduce code duplication
- Make the UI feel consistent across pages
- Create a scalable folder structure
- Separate marketing site, app dashboard, admin tools, and API concerns
- Prepare the codebase for image-generation workflows, template browsing, queues, billing, and user galleries

## Non-goals
- Do not rewrite the entire product from scratch unless absolutely necessary
- Do not introduce large dependencies unless there is a strong reason
- Do not break existing environment variable usage unless replacing it with a clearly better structure
- Do not remove working features just to make the code cleaner

## What “good” looks like
The result should be:
- easier to navigate
- easier to extend
- easier to hand off to another developer
- visually cleaner
- more consistent in naming, layout, spacing, and component reuse

## Required deliverables
1. Audit the current codebase structure
2. Propose a new target architecture
3. Move files into a cleaner structure
4. Consolidate repeated UI patterns into reusable components
5. Standardize page layouts
6. Remove dead or obviously redundant code where safe
7. Update imports and references
8. Ensure the app still builds
9. Add a short `RESTRUCTURE_SUMMARY.md` explaining:
   - what changed
   - why it changed
   - what still needs manual review

## Preferred architecture
Use a structure along these lines where appropriate:

- `src/app/(marketing)` for public landing / waitlist / pricing / about
- `src/app/(app)` for logged-in dashboard pages
- `src/app/(admin)` for admin-only tools
- `src/app/api` for route handlers
- `src/components/ui` for primitive reusable UI
- `src/components/layout` for shells, nav, sidebars, headers, footers
- `src/components/marketing` for landing-page sections
- `src/components/dashboard` for app-specific widgets
- `src/components/generation` for image generation flows
- `src/lib` for utilities, config, typed helpers, API clients
- `src/server` for server-only logic where appropriate
- `src/types` for shared types
- `src/styles` only if needed beyond existing globals

## UX priorities
- Premium SaaS feel
- Clear hierarchy
- Less clutter
- Better spacing
- Strong dashboard usability
- Mobile responsiveness
- Consistent buttons, cards, forms, and section spacing

## Coding rules
- Prefer small focused components
- Prefer composition over giant page files
- Keep naming explicit and consistent
- Avoid magic strings where avoidable
- Keep TypeScript types tight
- Preserve SEO metadata where present
- Preserve auth and billing flows
- Preserve current API behavior unless a change is clearly necessary

## Refactor rules
- Make high-confidence changes first
- When uncertain, leave a TODO comment rather than inventing behavior
- Keep existing business logic unless it is clearly broken
- Do not silently remove unfinished but important product areas
- If there are multiple possible structures, choose the one that best supports a multi-page SaaS app with image generation, galleries, subscriptions, and admin tools

## Validation
Before finishing:
- run the project build
- run typecheck if available
- run lint if available
- fix broken imports
- remove obviously orphaned files if safe

## Output style
Be action-oriented.
Do the refactor.
Do not stop after only describing a plan.
At the end, provide a concise summary of concrete file changes and follow-up items.