-- External letter history API support

alter table letter_templates
  add column if not exists api_slug text;

alter table communication_history
  add column if not exists letter_api_slug text;

create table if not exists external_api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  last_used_ip inet
);

alter table external_api_keys enable row level security;

drop policy if exists "service role manages external_api_keys" on external_api_keys;
create policy "service role manages external_api_keys"
  on external_api_keys for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function fupm_slugify_letter_type(input text)
returns text as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'template'
  );
$$ language sql immutable;

with template_slugs as (
  select
    id,
    fupm_slugify_letter_type(name) as base_slug,
    row_number() over (
      partition by company_id, fupm_slugify_letter_type(name)
      order by created_at, id
    ) as duplicate_number
  from letter_templates
  where api_slug is null
)
update letter_templates lt
set api_slug = case
  when ts.duplicate_number = 1 then ts.base_slug
  else ts.base_slug || '-' || ts.duplicate_number::text
end
from template_slugs ts
where lt.id = ts.id;

create unique index if not exists letter_templates_company_api_slug_unique
  on letter_templates(company_id, api_slug)
  where api_slug is not null;

create index if not exists external_api_keys_company_id_idx
  on external_api_keys(company_id);

create index if not exists external_api_keys_active_hash_idx
  on external_api_keys(key_hash)
  where revoked_at is null;

create index if not exists communication_history_external_lookup_idx
  on communication_history(company_id, job_name, letter_api_slug, sent_at desc);

update communication_history ch
set letter_api_slug = lt.api_slug
from letter_templates lt
where ch.template_id = lt.id
  and ch.letter_api_slug is null;
