# Quality Gates

This repo currently has legacy lint/type failures outside the active v2 + worker migration scope.

## Baseline (informational only)

- `npm run typecheck:baseline`
- `npm run lint:baseline`

These commands:

- run full-repo checks as-is
- save output under `tools/baseline/`
- always exit `0` so they never block delivery

Use them to track overall noise, not to gate deployment.

## Required gates (must pass)

- `npm run typecheck:v2`
- `npm run lint:v2`

These commands only check:

- `server/worker/**`
- v2/bridge API routes in `src/app/api/**`
- v2 pages in `src/app/{dashboard,portfolio,creators,production,calendar,intelligence}/**`
- v2-specific shared helpers/components used by that surface

Until legacy cleanup is complete, these two scripts are the enforcement boundary for new work.

## CI / local gate command

Run this in CI (or locally) to gate only v2 + worker scope:

`npm run typecheck:v2 && npm run lint:v2`
