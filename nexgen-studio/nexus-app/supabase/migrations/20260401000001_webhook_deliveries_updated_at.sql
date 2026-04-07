-- retry_failed_webhook_deliveries() updates updated_at; ensure column exists
alter table public.webhook_deliveries
  add column if not exists updated_at timestamptz not null default now();
