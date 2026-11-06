-- Run once in the Supabase SQL editor (for a database that already has schema v1).

-- Bun Maska as item #2
update items set sort = sort + 1 where sort >= 2;
insert into items (name, price, batch_type, cups, sort) values ('Bun Maska', 30, 'none', 1, 2);

-- Containers: no cup counts any more
alter table batches alter column qty_cups drop not null;

-- Discounts / free items
alter table sale_items add column list_price int;
update sale_items set list_price = unit_price where list_price is null;
alter table sales add column note text;

-- Udhaar
alter table sales add column person text;
alter table sales drop constraint sales_payment_check;
alter table sales add constraint sales_payment_check check (payment in ('cash','online','udhaar'));

create table udhaar (
  id uuid primary key,
  person text not null,
  kind text not null check (kind in ('credit_sale','cash_lent','repayment')),
  amount int not null check (amount > 0),
  method text check (method in ('cash','online')),
  sale_id uuid references sales(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
create index on udhaar (created_at);
alter table udhaar enable row level security;
create policy "shop" on udhaar for all to authenticated using (true) with check (true);
