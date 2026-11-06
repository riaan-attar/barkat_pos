-- Fresh install: run this whole file in the Supabase SQL editor.
-- Existing database: run migration_002.sql, then migration_003.sql instead.
create table items (
  id serial primary key,
  name text not null,
  price int not null,
  batch_type text not null default 'none' check (batch_type in ('chai','black_tea','none')),
  cups int not null default 1,          -- cups drawn from the batch per unit sold
  active boolean not null default true,
  sort int not null default 0
);

create table batches (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('chai','black_tea')),
  started_at timestamptz not null default now(),
  qty_cups int,                         -- unused: a batch is one container
  closed_at timestamptz,
  wasted_cups int not null default 0
);

create table sales (
  id uuid primary key,                  -- generated on the client so retries are idempotent
  created_at timestamptz not null default now(),
  payment text not null check (payment in ('cash','online','udhaar')),
  total int not null,
  note text,
  person text,                          -- who took it on udhaar
  voided_at timestamptz,                -- set when a bill is voided (never deleted)
  constraint sales_total_nonneg check (total >= 0)
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  item_id int not null references items(id),
  qty int not null check (qty > 0),
  unit_price int not null check (unit_price >= 0),
  list_price int,                       -- menu price; unit_price < list_price means discount
  batch_id uuid references batches(id)
);
create index on sales (created_at);
create index on sale_items (sale_id);
create index on sale_items (batch_id);

create table udhaar (
  id uuid primary key,
  person text not null,
  kind text not null check (kind in ('credit_sale','cash_lent','repayment')),
  amount int not null check (amount > 0),
  method text check (method in ('cash','online')),
  sale_id uuid references sales(id) on delete cascade,
  note text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint udhaar_person_nonblank check (length(btrim(person)) > 0)
);
create index on udhaar (created_at);

alter table udhaar enable row level security;
create policy "shop" on udhaar for all to authenticated using (true) with check (true);

alter table items enable row level security;
alter table batches enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
create policy "shop" on items for all to authenticated using (true) with check (true);
create policy "shop" on batches for all to authenticated using (true) with check (true);
create policy "shop" on sales for all to authenticated using (true) with check (true);
create policy "shop" on sale_items for all to authenticated using (true) with check (true);

-- Functions used by the app (see migration_003.sql for comments)
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

insert into items (name, price, batch_type, cups, sort) values
  ('Chai', 15, 'chai', 1, 1),
  ('Bun Maska', 30, 'none', 1, 2),
  ('Full Chai', 30, 'chai', 2, 3),
  ('Special Chai', 40, 'chai', 1, 4),
  ('Coffee', 40, 'none', 1, 5),
  ('Black Tea', 12, 'black_tea', 1, 6),
  ('Biscuit', 5, 'none', 1, 7),
  ('Toast', 5, 'none', 1, 8),
  ('Cream Roll', 10, 'none', 1, 9),
  ('Khari', 15, 'none', 1, 10);
