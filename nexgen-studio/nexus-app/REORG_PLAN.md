# Reorganization Plan — nexgen-studio/nexus-app

Goal: reduce nesting, remove confusing duplicate Git repo, and make the app easier to navigate.

Proposed safe changes (stepwise):

1) Flatten accidental nested repo
   - We backed up the nested `.git` into `nested-git-backup/` (safe).

2) Rename / move noisy folders (non-destructive; will update imports where needed):
   - `worker/` -> `server/worker/` (co-locate server-side code under `server/`).
   - `scripts/` -> `tools/` or `scripts/` at repo root (decide preference).
   - `nexgen-studio/nexus-app/nexgen-studio/` appears to be a stray git folder — it was removed from the active workspace and backed up.

3) Consolidate README and index files
   - Add short `README.md` files to key folders: `src/`, `src/components/`, `src/app/`, `worker/` (done for `src`).

4) Automated import updates
   - After moves, run a script to update TypeScript/JS import paths and `tsconfig` baseUrl/paths if necessary.

5) Smoke test
   - Run `npm run dev` and `npm run dev:worker` to confirm app and worker still work.

Notes and next steps

- I can perform the file moves and automatically update imports. This is somewhat invasive but can be done safely in small steps with backups and tests after each step.
- Confirm the exact target names for moves: do you prefer `server/worker` or `worker-service`? Should `scripts/` stay in place or move to repo root as `tools/`?
