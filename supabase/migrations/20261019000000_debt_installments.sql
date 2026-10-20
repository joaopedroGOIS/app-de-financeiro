-- Add monthly debt planning without changing existing balances or ownership policies.
begin;
alter table public.assets add column if not exists installment_count integer;
alter table public.assets add column if not exists first_due_date date;
alter table public.assets add constraint assets_installment_plan_valid check (
  (installment_count is null and first_due_date is null)
  or (kind = 'liability' and installment_count is not null and first_due_date is not null
    and installment_count between 1 and 360 and amount_cents >= installment_count
    and first_due_date >= date '1900-01-01'
    and first_due_date + (installment_count - 1) * interval '1 month' < date '10000-01-01')
);
comment on column public.assets.installment_count is 'Monthly planning only. Does not create expenses, payments or rewards.';
notify pgrst, 'reload schema';
commit;
