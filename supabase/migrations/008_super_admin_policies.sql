-- Super admins can read all companies and members (needed for Admin page)

create policy "super admins can view all companies"
  on companies for select
  using (auth.uid() in (select user_id from super_admins));

create policy "super admins can view all company_members"
  on company_members for select
  using (auth.uid() in (select user_id from super_admins));

create policy "super admins can update all companies"
  on companies for update
  using (auth.uid() in (select user_id from super_admins));
