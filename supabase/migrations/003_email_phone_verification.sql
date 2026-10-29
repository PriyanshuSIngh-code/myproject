-- Verification and payment hardening. Review in staging before production.
-- Supabase Auth is the source of truth for confirmed email/phone identities.
create or replace function public.is_dual_verified()
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and u.phone_confirmed_at is not null
  )
$$;

-- Keep user-submitted payment claims constrained to active published plans and exact prices.
create or replace function public.validate_payment_claim()
returns trigger language plpgsql security definer set search_path = public
as $$
declare expected_amount integer;
begin
  if new.status not in ('pending','submitted') then
    raise exception 'New payment claims must start pending or submitted';
  end if;
  select amount_inr into expected_amount from public.subscription_plans
    where id = new.plan_id and active = true;
  if expected_amount is null or new.amount_inr <> expected_amount then
    raise exception 'Selected plan price does not match the active plan';
  end if;
  if new.method = 'upi_manual' and coalesce(length(trim(new.upi_reference)),0) < 8 then
    raise exception 'A valid UPI reference is required';
  end if;
  return new;
end $$;

drop trigger if exists payment_claim_validate on public.subscription_payments;
create trigger payment_claim_validate before insert on public.subscription_payments
for each row execute function public.validate_payment_claim();

-- Users may not update payment status, amount, plan or verification fields themselves.
revoke update on public.subscription_payments from authenticated;
grant update (upi_reference, proof_path) on public.subscription_payments to authenticated;
