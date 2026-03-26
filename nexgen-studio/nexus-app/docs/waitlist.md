# Beta waitlist (`/api/waitlist`)

## Behavior

- `POST /api/waitlist` is **public** (no session).
- Body: `{ email, name?, contentGoals?, source? }` (see `src/app/api/waitlist/waitlistBody.ts`).

## Persistence

1. Apply migration `supabase/migrations/20260322000000_waitlist_signups.sql` to create `public.waitlist_signups`.
2. Set server-only env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

If those are unset, signups still return `200 { ok: true }` and are logged to server stdout (useful for local dev).

## Verify

```bash
pnpm test:waitlist
```

## UI

Landing form: `src/components/marketing/LandingWaitlistSection.tsx` → `fetch('/api/waitlist', { method: 'POST', ... })`.
