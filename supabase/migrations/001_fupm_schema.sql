-- FUPM: Follow Up Payment Machine
-- Migration 001: Core schema

-- ─────────────────────────────────────────────
-- Companies
-- ─────────────────────────────────────────────
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- Company Members
-- ─────────────────────────────────────────────
create table if not exists company_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  role text not null default 'member',  -- 'member' | 'admin'
  display_name text,
  rep_phone text,
  rep_email text,
  unique(user_id, company_id)
);

-- ─────────────────────────────────────────────
-- Super Admins (shared table — do not recreate if exists)
-- ─────────────────────────────────────────────
create table if not exists super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ─────────────────────────────────────────────
-- User App Access (shared table)
-- ─────────────────────────────────────────────
create table if not exists user_app_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  app_name text not null,
  role text,
  granted_at timestamptz default now(),
  unique(user_id, app_name)
);

-- ─────────────────────────────────────────────
-- Company Settings
-- ─────────────────────────────────────────────
create table if not exists company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade unique,
  logo_url text,
  payment_qr_url text,
  company_name text not null default 'Allied Restoration Services Inc.',
  address_line1 text,
  city text,
  state text,
  zip text,
  license_org text,
  license_number text,
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_phone_number text,
  postgrid_api_key text,
  resend_api_key text,
  albi_sheet_url text,
  albi_last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- Albi Jobs
-- ─────────────────────────────────────────────
create table if not exists albi_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  customer text,
  customer_email text,
  customer_phone_number text,
  address_1 text,
  city text,
  state text,
  zip_code text,
  mailing_address_1 text,
  mailing_city text,
  mailing_state text,
  mailing_zip_code text,
  total_invoice_amount numeric,
  total_payment_amount numeric,
  deductible numeric,
  created_at_albi timestamptz,
  link_to_project text,
  sales_person text,
  inspection_date date,
  estimator text,
  estimated_revenue numeric,
  estimated_work_start_date date,
  file_closed boolean,
  referrer text,
  estimate_sent boolean,
  project_manager text,
  status text,
  total_actual_expenses numeric,
  accrual_revenue numeric,
  contract_signed boolean,
  coc_cos_signed boolean,
  invoiced boolean,
  insurance_company text,
  insurance_claim_number text,
  work_start date,
  property_type text,
  paid boolean,
  estimated_completion_date date,
  imported_at timestamptz default now(),
  import_source text,
  unique(company_id, name)
);

-- ─────────────────────────────────────────────
-- Letter Templates
-- ─────────────────────────────────────────────
create table if not exists letter_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  description text,
  body text not null,
  requires_due_date boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- Communication History
-- ─────────────────────────────────────────────
create table if not exists communication_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  job_name text not null,
  template_id uuid references letter_templates(id) on delete set null,
  template_name text not null,
  sent_at timestamptz default now(),
  sent_by uuid references auth.users(id),
  sent_by_name text,
  channels text[] not null,
  amount_due numeric,
  sms_status text,
  mail_status text,
  email_status text,
  sms_error text,
  mail_error text,
  email_error text,
  postgrid_letter_id text,
  twilio_message_sid text,
  rendered_body text,
  email_subject text,
  email_body_text text,
  sms_body text,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  mailing_address jsonb
);

-- ─────────────────────────────────────────────
-- RLS: Enable on all tables
-- ─────────────────────────────────────────────
alter table companies enable row level security;
alter table company_members enable row level security;
alter table company_settings enable row level security;
alter table albi_jobs enable row level security;
alter table letter_templates enable row level security;
alter table communication_history enable row level security;
alter table user_app_access enable row level security;

-- ─────────────────────────────────────────────
-- RLS Policies: companies
-- ─────────────────────────────────────────────
create policy "members can read own company"
  on companies for select
  using (
    id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages companies"
  on companies for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RLS Policies: company_members
-- ─────────────────────────────────────────────
create policy "members can read own company_members"
  on company_members for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "users can read own membership"
  on company_members for select
  using (user_id = auth.uid());

create policy "service role manages company_members"
  on company_members for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RLS Policies: company_settings
-- ─────────────────────────────────────────────
create policy "members can read own company_settings"
  on company_settings for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages company_settings"
  on company_settings for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RLS Policies: albi_jobs
-- ─────────────────────────────────────────────
create policy "company members can read own jobs"
  on albi_jobs for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages jobs"
  on albi_jobs for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RLS Policies: letter_templates
-- ─────────────────────────────────────────────
create policy "members can read own templates"
  on letter_templates for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages templates"
  on letter_templates for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RLS Policies: communication_history
-- ─────────────────────────────────────────────
create policy "members can read own history"
  on communication_history for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages history"
  on communication_history for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RLS Policies: user_app_access
-- ─────────────────────────────────────────────
create policy "users can read own app access"
  on user_app_access for select
  using (user_id = auth.uid());

create policy "service role manages app access"
  on user_app_access for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- DB trigger: auto-grant fupm access on invite
-- ─────────────────────────────────────────────
create or replace function handle_new_user_app_access()
returns trigger as $$
begin
  if new.raw_user_meta_data->>'signup_app' = 'fupm' then
    insert into user_app_access (user_id, app_name)
    values (new.id, 'fupm')
    on conflict (user_id, app_name) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created_fupm_access
  after insert on auth.users
  for each row execute procedure handle_new_user_app_access();
