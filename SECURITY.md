# Security Policy — Jobryn

## Secrets

Never commit `.env`, Stripe secret keys, webhook secrets, OAuth client secrets, Supabase service-role keys or AI provider keys. Browser code may use only Supabase publishable/anon credentials.

## Tenant isolation

Every tenant-owned record carries `workspace_id`. Protected API routes verify the authenticated user and workspace membership server-side. Database RLS is the second enforcement boundary. New tables and routes are not complete until both checks exist and cross-tenant tests pass.

## Authorization

Do not trust workspace IDs, roles, plan names, prices or resource ownership sent by the browser. Derive and verify them on the server. High-risk owner/admin actions may require MFA (AAL2).

## Billing and webhooks

Stripe webhook signatures are verified against the raw request body. Event IDs are claimed atomically before mutation. Subscription state comes from Stripe, not browser input. Never let users write entitlement/subscription state directly through Supabase.

## Data writes

Validate request bodies at the HTTP boundary. Financial and metered operations must be idempotent and transaction-safe.

## AI

AI models must not have database credentials. They act through an allowlisted tool layer with permission checks, schema validation, execution/cost limits, audit records and human approval for risky actions.

## Vulnerability reporting

Do not include customer data, credentials or exploit payloads containing live secrets in a report. Reproduce issues in a test workspace where possible.
