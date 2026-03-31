-- Inbound SMS messages received via Twilio webhook
create table if not exists sms_inbound (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies(id) on delete cascade,
  from_phone   text not null,        -- 10-digit normalized
  to_phone     text,                 -- company's Twilio number, 10-digit
  body         text,
  twilio_sid   text unique,
  job_name     text,                 -- matched from most recent outbound SMS to this phone
  received_at  timestamptz not null default now()
);

alter table sms_inbound enable row level security;

create policy "members can read own sms_inbound"
  on sms_inbound for select
  using (
    company_id in (select company_id from company_members where user_id = auth.uid())
  );

create policy "service role manages sms_inbound"
  on sms_inbound for all
  using (auth.role() = 'service_role');

create index sms_inbound_company_phone_idx on sms_inbound(company_id, from_phone);
create index sms_inbound_received_at_idx on sms_inbound(received_at desc);
