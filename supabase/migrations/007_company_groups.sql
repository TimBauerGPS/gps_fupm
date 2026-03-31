-- ─────────────────────────────────────────────
-- Company Groups
-- Allows multiple companies to share templates
-- ─────────────────────────────────────────────
create table if not exists company_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

alter table company_groups enable row level security;

create policy "members can read own group"
  on company_groups for select
  using (
    id in (
      select c.group_id from companies c
      join company_members cm on cm.company_id = c.id
      where cm.user_id = auth.uid()
      and c.group_id is not null
    )
  );

create policy "service role manages groups"
  on company_groups for all
  using (auth.role() = 'service_role');

-- Add group_id to companies
alter table companies add column if not exists group_id uuid references company_groups(id) on delete set null;

-- Add group_id to letter_templates
-- A template is either company-level (company_id set) or group-level (group_id set)
alter table letter_templates add column if not exists group_id uuid references company_groups(id) on delete cascade;

-- ─────────────────────────────────────────────
-- Update letter_templates RLS to include group templates
-- ─────────────────────────────────────────────

-- Drop old select-only policy and replace with one that includes group templates
drop policy if exists "members can view own templates" on letter_templates;

create policy "members can view own and group templates"
  on letter_templates for select
  using (
    -- Company-level templates
    company_id in (select company_id from company_members where user_id = auth.uid())
    OR
    -- Group-level templates for companies in the same group
    group_id in (
      select c.group_id from companies c
      join company_members cm on cm.company_id = c.id
      where cm.user_id = auth.uid()
      and c.group_id is not null
    )
  );
