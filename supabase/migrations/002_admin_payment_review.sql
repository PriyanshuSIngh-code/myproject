-- Secure owner-controlled manual payment review.
-- Apply only after reviewing your deployment settings. Never allow users to change profiles.role.
alter table public.subscription_payments add column if not exists review_note text;

create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_decision text,
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.subscription_payments%rowtype;
  plan_months integer;
begin
  if auth.uid() is null or public.current_user_role() <> 'admin' then
    raise exception 'Owner admin access required' using errcode = '42501';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception 'Decision must be approve or reject';
  end if;

  select * into payment_row
  from public.subscription_payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'Payment not found'; end if;
  if payment_row.status <> 'submitted' then
    raise exception 'Only submitted payments can be reviewed';
  end if;

  if p_decision = 'approve' then
    select duration_months into plan_months
    from public.subscription_plans where id = payment_row.plan_id and active = true;
    if plan_months is null then raise exception 'Plan is not active'; end if;

    update public.subscription_payments
      set status = 'verified', verified_by = auth.uid(), verified_at = now(), review_note = coalesce(p_note,'')
      where id = p_payment_id;

    insert into public.advocate_subscriptions(user_id, payment_id, starts_at, ends_at, active)
      values(payment_row.user_id, payment_row.id, now(), now() + make_interval(months => plan_months), true)
      on conflict (payment_id) do nothing;
  else
    if length(trim(coalesce(p_note,''))) < 4 then
      raise exception 'Please provide a rejection reason of at least 4 characters';
    end if;
    update public.subscription_payments
      set status = 'rejected', verified_by = auth.uid(), verified_at = now(), review_note = trim(p_note)
      where id = p_payment_id;
  end if;

  insert into public.audit_events(actor_id, action, target_type, target_id, metadata)
  values(auth.uid(), 'payment_' || p_decision, 'subscription_payment', p_payment_id::text,
    jsonb_build_object('amount_inr', payment_row.amount_inr, 'plan_id', payment_row.plan_id, 'note', coalesce(p_note,'')));

  return jsonb_build_object('ok', true, 'status', case when p_decision='approve' then 'verified' else 'rejected' end);
end;
$$;

revoke all on function public.admin_review_payment(uuid,text,text) from public, anon;
grant execute on function public.admin_review_payment(uuid,text,text) to authenticated;

-- IMPORTANT: from the Supabase SQL Editor, assign the real owner's existing auth user UUID manually:
-- update public.profiles set role = 'admin' where id = 'OWNER_AUTH_USER_UUID';
-- Never expose a public sign-up form or client-side operation that grants the admin role.
