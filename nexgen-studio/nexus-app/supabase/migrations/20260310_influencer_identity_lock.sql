-- Add identity lock fields to influencers for face consistency across generations.
-- reference_image_url: public URL for IP-Adapter / ref image (e.g. Supabase storage)
-- reference_image_storage_key: storage path for server-side resolution
-- lora_model_path already exists; we ensure it's used when present.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'influencers') then
    alter table public.influencers add column if not exists reference_image_url text;
    alter table public.influencers add column if not exists reference_image_storage_key text;
    comment on column public.influencers.reference_image_url is 'Public URL of locked face/body reference for IP-Adapter.';
    comment on column public.influencers.reference_image_storage_key is 'Storage key for server-side workflow injection.';
  end if;
end $$;
