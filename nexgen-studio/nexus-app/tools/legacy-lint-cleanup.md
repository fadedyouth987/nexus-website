# Legacy Lint Cleanup Plan

This plan is informational only. No legacy files are modified by this document.

## Baseline source

- Snapshot file: `tools/baseline/lint.txt`
- Generated from: `npm run lint:baseline`
- Snapshot date: 2026-03-05

## Top noise categories (current baseline)

| Rule | Findings (rough) | Files (rough) | Notes |
| --- | ---: | ---: | --- |
| `react-hooks/rules-of-hooks` | 745 | 21 | High volume, largely from generated build artifacts. |
| `@next/next/no-assign-module-variable` | 116 | 12 | Common in generated runtime chunks. |
| `@typescript-eslint/no-unused-vars` | 52 | 15 | Mix of generated and source files. |
| `react-hooks/exhaustive-deps` | 21 | 5 | Real app code and generated output. |
| `react/no-unescaped-entities` | 16 | 2 | Mostly content/JSX text cleanup. |
| `@typescript-eslint/no-extra-semi` | 15 | 5 | Mechanical formatting-level fixes. |
| `@next/internal/typechecked-require` | 8 | 8 | Mostly framework/build internals in artifacts. |
| `react/no-find-dom-node` | 7 | 7 | Older React patterns in included files. |
| `@typescript-eslint/ban-ts-comment` | 7 | 7 | Requires triage: justified vs removable suppressions. |
| `@next/internal/no-ambiguous-jsx` | 3 | 3 | Low volume, targeted fixes. |

## Suggested cleanup order

1. Stop linting generated outputs first (`.next/`, `.next.stale/`, build artifacts) so baseline reflects real source code.
2. Resolve config/plugin drift (`@typescript-eslint` rule-definition issues) to prevent false/duplicate noise.
3. Fix hook correctness in source (`rules-of-hooks`, then `exhaustive-deps`).
4. Clean TypeScript hygiene (`no-unused-vars`, `ban-ts-comment`, `no-extra-semi`).
5. Clean Next.js + React presentation rules (`no-img-element`, `no-unescaped-entities`, `jsx-key`).
6. Re-run baseline and re-rank categories after each batch.

## Rough effort estimate

- Pass 1 (ignore generated artifacts + config sanity): 0.5-1 day.
- Pass 2 (hooks + TS hygiene): 1-2 days.
- Pass 3 (remaining React/Next rules): 0.5-1 day.

Total rough estimate: 2-4 days of focused cleanup, depending on scope accepted in each pass.