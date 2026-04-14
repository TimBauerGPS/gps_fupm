create table if not exists short_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  slug text not null unique,
  destination_url text not null,
  created_at timestamptz not null default now()
);

alter table short_links enable row level security;

create policy "members can read own short_links"
  on short_links for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages short_links"
  on short_links for all
  using (auth.role() = 'service_role');

create index if not exists short_links_company_created_idx on short_links(company_id, created_at desc);
