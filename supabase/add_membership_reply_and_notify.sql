-- Membership interest: email replies + per-person new-application notification opt-in.
alter table membership_interest_applications
  add column if not exists reply_message text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by_personnel_id uuid references personnel(id) on delete set null;

alter table department_personnel
  add column if not exists notify_membership_interest boolean not null default false;
