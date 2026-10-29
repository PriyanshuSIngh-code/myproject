-- NayayaMitra starter schema. Review policies before production.
create extension if not exists pgcrypto;

create type public.app_role as enum ('user','advocate','admin');
create type public.review_status as enum ('pending','approved','rejected');
create type public.listing_kind as enum ('private','legal_aid');
create type public.payment_status as enum ('pending','submitted','verified','rejected','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'user',
  google_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Never let a user grant themselves admin privileges. Role changes belong to a trusted server/admin process.
create table public.advocate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  city text not null,
  practice_areas text[] not null default '{}',
  bar_certificate_path text not null,
  law_degree_path text not null,
  status public.review_status not null default 'pending',
  reviewer_id uuid references auth.users(id),
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.advocate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  city text,
  state text,
  practice_areas text[] not null default '{}',
  bio text,
  listing_type public.listing_kind not null default 'private',
  verification_status public.review_status not null default 'pending',
  source_checked_at timestamptz,
  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_plans (
  id text primary key,
  title text not null,
  amount_inr integer not null check (amount_inr > 0),
  duration_months integer not null check (duration_months > 0),
  active boolean not null default true
);
insert into public.subscription_plans(id,title,amount_inr,duration_months) values
 ('monthly','Monthly listing',500,1),
 ('half_year','Six-month listing',2499,6)
on conflict (id) do update set title=excluded.title, amount_inr=excluded.amount_inr, duration_months=excluded.duration_months;

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  amount_inr integer not null check (amount_inr > 0),
  method text not null check (method in ('upi_manual','razorpay')),
  status public.payment_status not null default 'pending',
  upi_reference text,
  proof_path text,
  gateway_order_id text unique,
  gateway_payment_id text unique,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table public.advocate_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null unique references public.subscription_payments(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.legal_chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  question_redacted text not null,
  language text not null default 'English',
  source_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_dual_verified()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and google_verified_at is not null
      and phone_verified_at is not null
  )
$$;

alter table public.profiles enable row level security;
alter table public.advocate_applications enable row level security;
alter table public.advocate_profiles enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.advocate_subscriptions enable row level security;
alter table public.legal_chat_logs enable row level security;
alter table public.audit_events enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using (id=auth.uid());
create policy "users update own basic profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role = public.current_user_role());
-- Restrict user-editable profile columns. Verification timestamps and roles must be written only by trusted server-side flows.
revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

create policy "applicant reads own application" on public.advocate_applications for select to authenticated using (user_id=auth.uid() or public.current_user_role()='admin');
create policy "dual verified user submits application" on public.advocate_applications for insert to authenticated with check (user_id=auth.uid() and public.is_dual_verified());
create policy "admin updates applications" on public.advocate_applications for update to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');

create policy "public can view approved advocate listings" on public.advocate_profiles for select to anon, authenticated using (verification_status='approved');
create policy "admin manages advocate listings" on public.advocate_profiles for all to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');

create policy "plans readable" on public.subscription_plans for select to anon, authenticated using (active=true);
create policy "users read own payments" on public.subscription_payments for select to authenticated using (user_id=auth.uid() or public.current_user_role()='admin');
create policy "dual verified user submits payment record" on public.subscription_payments for insert to authenticated with check (user_id=auth.uid() and public.is_dual_verified() and status in ('pending','submitted'));
create policy "admin reviews payments" on public.subscription_payments for update to authenticated using (public.current_user_role()='admin') with check (public.current_user_role()='admin');
create policy "users read own subscriptions" on public.advocate_subscriptions for select to authenticated using (user_id=auth.uid() or public.current_user_role()='admin');
create policy "users read own chat logs" on public.legal_chat_logs for select to authenticated using (user_id=auth.uid() or public.current_user_role()='admin');
create policy "dual verified user creates chat log" on public.legal_chat_logs for insert to authenticated with check (user_id=auth.uid() and public.is_dual_verified());
create policy "admin reads audit events" on public.audit_events for select to authenticated using (public.current_user_role()='admin');
create policy "admin inserts audit events" on public.audit_events for insert to authenticated with check (public.current_user_role()='admin');

-- Profiles should be created by a trusted trigger/function. This trigger creates a basic row only;
-- it does not set google_verified_at based on untrusted user metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage buckets should be created as PRIVATE in Supabase Storage:
-- advocate-documents, payment-proofs. Configure strict storage.objects policies separately.
-- Do not use public buckets for enrollment certificates or payment evidence.
