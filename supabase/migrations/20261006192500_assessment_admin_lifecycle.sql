-- Secure assessment publishing lifecycle and admin audit trail.
-- Firebase Auth remains the identity provider; Supabase stores assessment execution/audit data.

create table if not exists public.assessment_admin_audit (
  id uuid primary key default gen_random_uuid(),
  assessment_id text not null,
  admin_id text not null,
  action text not null,
  previous_status text,
  new_status text,
  validation_passed boolean not null default false,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint assessment_admin_audit_action_check
    check (action in ('validate', 'review', 'publish', 'retire'))
);

create index if not exists idx_assessment_admin_audit_assessment
  on public.assessment_admin_audit (assessment_id, created_at desc);

create index if not exists idx_assessment_admin_audit_admin
  on public.assessment_admin_audit (admin_id, created_at desc);

alter table public.assessment_admin_audit enable row level security;
revoke all on public.assessment_admin_audit from anon, authenticated;
