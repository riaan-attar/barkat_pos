-- Production hardening. Run once, after migration_002.sql.

-- 1. Voiding: bills are never deleted, only marked void (and can be restored).
alter table sales  add column voided_at timestamptz;
alter table udhaar add column voided_at timestamptz;

-- 2. Sanity checks on money columns.
alter table sales      add constraint sales_total_nonneg check (total >= 0);
alter table sale_items add constraint sale_items_price_nonneg check (unit_price >= 0);
alter table udhaar     add constraint udhaar_person_nonblank check (length(btrim(person)) > 0);

-- 3. Record a whole bill atomically (sale + lines + udhaar ledger row).
--    Safe to call repeatedly with the same id (the app retries after network errors).
create or replace function record_sale(p jsonb) returns void
language plpgsql security invoker as $$
declare
  sid uuid := (p->>'id')::uuid;
  at  timestamptz := (p->>'created_at')::timestamptz;
begin
  insert into sales (id, created_at, payment, total, note, person)
  values (sid, at, p->>'payment', (p->>'total')::int, nullif(p->>'note', ''), nullif(p->>'person', ''))
  on conflict (id) do update set
    created_at = excluded.created_at, payment = excluded.payment, total = excluded.total,
    note = excluded.note, person = excluded.person;

  delete from sale_items where sale_id = sid;
  insert into sale_items (sale_id, item_id, qty, unit_price, list_price, batch_id)
  select sid, (l->>'item_id')::int, (l->>'qty')::int, (l->>'unit_price')::int,
         (l->>'list_price')::int, nullif(l->>'batch_id', '')::uuid
  from jsonb_array_elements(p->'lines') l;

  if p->>'payment' = 'udhaar' then
    insert into udhaar (id, person, kind, amount, sale_id, created_at)
    values (sid, btrim(p->>'person'), 'credit_sale', (p->>'total')::int, sid, at)
    on conflict (id) do update set person = excluded.person, amount = excluded.amount, created_at = excluded.created_at;
  else
    delete from udhaar where id = sid;
  end if;
end $$;

-- 4. Void / restore a bill together with its udhaar ledger row.
create or replace function set_sale_voided(p_id uuid, p_voided boolean) returns void
language plpgsql security invoker as $$
begin
  update sales  set voided_at = case when p_voided then now() end where id = p_id;
  update udhaar set voided_at = case when p_voided then now() end where sale_id = p_id;
end $$;

revoke execute on function record_sale(jsonb) from public, anon;
revoke execute on function set_sale_voided(uuid, boolean) from public, anon;
grant  execute on function record_sale(jsonb) to authenticated;
grant  execute on function set_sale_voided(uuid, boolean) to authenticated;
