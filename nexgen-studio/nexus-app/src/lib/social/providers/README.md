# Social provider adapters

Each platform implements `ISocialProvider` from `../providerInterface`.

## Implemented

- **Instagram** (`instagram.ts`) – Meta Graph API: OAuth, publish (image/carousel), insights, webhooks.
- **Facebook** (`facebook.ts`) – Meta Graph API: OAuth, publish, webhook verification.

## Stubs (not yet implemented)

The following use `createStubProvider()` and will throw or return errors when used for OAuth/publish:

- TikTok
- Twitter / X
- YouTube
- LinkedIn
- Pinterest
- Reddit

## Adding a new provider

1. Create `src/lib/social/providers/<provider>.ts`.
2. Implement `ISocialProvider`: `getOAuthConfig`, `exchangeCodeForTokens`, `refreshToken`, `publishPost`, `fetchAnalytics`, `verifyWebhook`, `parseWebhookPayload`.
3. In `index.ts`, replace `createStubProvider('providerId')` with your adapter instance.
4. Add OAuth env vars (e.g. `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`) to `.env.local.example`.
5. Add a webhook route under `src/app/api/webhooks/<provider>/route.ts` if the platform sends webhooks.

See `instagram.ts` for a full reference implementation.
