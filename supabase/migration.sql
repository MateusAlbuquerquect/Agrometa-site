-- =============================================================================
-- AGROMETA — Migração de colunas faltantes + view + triggers + RLS
-- Execute este arquivo no SQL Editor do Supabase
-- Seguro para rodar em banco existente (não destrói dados)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COLUNAS FALTANTES em inventory_items
-- ---------------------------------------------------------------------------

alter table public.inventory_items
  add column if not exists min_quantity        numeric not null default 0,
  add column if not exists quantidade_atual    numeric not null default 0,
  add column if not exists avg_price_per_unit  numeric not null default 0,
  add column if not exists ultima_movimentacao timestamptz not null default now(),
  add column if not exists sub_type            text,
  add column if not exists batch_code          text,
  add column if not exists notes               text,
  add column if not exists updated_at          timestamptz not null default now();

-- Se a tabela tiver coluna "quantity" em vez de "quantidade_atual", renomeia
-- (descomente apenas se necessário — verifique antes com: \d inventory_items)
-- alter table public.inventory_items rename column quantity to quantidade_atual;

-- ---------------------------------------------------------------------------
-- 2. COLUNAS FALTANTES em outras tabelas
-- ---------------------------------------------------------------------------

-- plots: updated_at
alter table public.plots
  add column if not exists updated_at timestamptz not null default now();

-- operations: colunas usadas pelo Boletim e MachinesModule
alter table public.operations
  add column if not exists type             text,
  add column if not exists activity_type    text,
  add column if not exists operation_date   date,
  add column if not exists quantity_used    numeric,
  add column if not exists unit             text,
  add column if not exists custo_operacao   numeric,
  add column if not exists horimetro_inicio numeric,
  add column if not exists horimetro_fim    numeric,
  add column if not exists started_at       timestamptz,
  add column if not exists ended_at         timestamptz;

-- inventory_transactions: colunas de custo e FK de operação
alter table public.inventory_transactions
  add column if not exists valor_total_compra  numeric,
  add column if not exists custo_unitario      numeric,
  add column if not exists operation_id        uuid,
  add column if not exists notes               text;

-- ---------------------------------------------------------------------------
-- 3. TABELAS QUE PODEM NÃO EXISTIR
-- ---------------------------------------------------------------------------

create table if not exists public.operation_inputs (
  id             uuid primary key default gen_random_uuid(),
  operation_id   uuid not null references public.operations(id) on delete cascade,
  item_id        uuid not null references public.inventory_items(id) on delete cascade,
  quantity_used  numeric not null,
  custo_unitario numeric,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. VIEW: inventory_alerts
-- ---------------------------------------------------------------------------

create or replace view public.inventory_alerts as
select
  id,
  farm_id,
  name,
  category,
  quantidade_atual  as quantity,
  min_quantity,
  unit,
  case
    when quantidade_atual <= 0                     then 'empty'
    when quantidade_atual <= min_quantity * 0.5    then 'critical'
    else                                                'low'
  end as alert_level
from public.inventory_items
where min_quantity > 0
  and quantidade_atual <= min_quantity;

-- ---------------------------------------------------------------------------
-- 5. TRIGGER: atualiza quantidade_atual após transação de estoque
-- ---------------------------------------------------------------------------

create or replace function public.fn_update_inventory_item_on_transaction()
returns trigger language plpgsql as $$
declare
  v_qty     numeric;
  v_avg     numeric;
  v_new_qty numeric;
  v_new_avg numeric;
begin
  select quantidade_atual, avg_price_per_unit
  into   v_qty, v_avg
  from   public.inventory_items
  where  id = NEW.item_id;

  v_new_qty := coalesce(v_qty, 0) + NEW.quantity;

  if NEW.quantity > 0 and NEW.custo_unitario is not null and NEW.custo_unitario > 0 then
    if coalesce(v_qty, 0) <= 0 then
      v_new_avg := NEW.custo_unitario;
    else
      v_new_avg := (v_qty * coalesce(v_avg, 0) + NEW.quantity * NEW.custo_unitario) / v_new_qty;
    end if;
  else
    v_new_avg := coalesce(v_avg, 0);
  end if;

  update public.inventory_items
  set
    quantidade_atual    = v_new_qty,
    avg_price_per_unit  = v_new_avg,
    ultima_movimentacao = NEW.created_at,
    updated_at          = now()
  where id = NEW.item_id;

  return NEW;
end;
$$;

drop trigger if exists trg_inventory_transaction on public.inventory_transactions;
create trigger trg_inventory_transaction
  after insert on public.inventory_transactions
  for each row execute function public.fn_update_inventory_item_on_transaction();

-- ---------------------------------------------------------------------------
-- 6. TRIGGER: atualiza horimetro_atual da máquina após operação
-- ---------------------------------------------------------------------------

create or replace function public.fn_update_machine_horimetro()
returns trigger language plpgsql as $$
begin
  if NEW.machine_id is not null and NEW.horimetro_fim is not null then
    update public.machines
    set    horimetro_atual = NEW.horimetro_fim
    where  id = NEW.machine_id
      and  horimetro_atual < NEW.horimetro_fim;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_machine_horimetro on public.operations;
create trigger trg_machine_horimetro
  after insert on public.operations
  for each row execute function public.fn_update_machine_horimetro();

-- ---------------------------------------------------------------------------
-- 7. TRIGGER: cria perfil ao registrar usuário
-- ---------------------------------------------------------------------------

create or replace function public.fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.profiles               enable row level security;
alter table public.farms                  enable row level security;
alter table public.farm_members           enable row level security;
alter table public.plots                  enable row level security;
alter table public.machines               enable row level security;
alter table public.inventory_items        enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.operations             enable row level security;
alter table public.operation_inputs       enable row level security;

create or replace function public.my_farm_ids()
returns setof uuid language sql stable security definer as $$
  select farm_id from public.farm_members where user_id = auth.uid();
$$;

-- profiles
drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or id in (
      select fm.user_id from public.farm_members fm
      where fm.farm_id in (select public.my_farm_ids())
    )
  );
create policy "profiles_self" on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- farms
drop policy if exists "farms_via_membership" on public.farms;
create policy "farms_via_membership" on public.farms
  for all to authenticated
  using (id in (select public.my_farm_ids()))
  with check (id in (select public.my_farm_ids()));

-- farm_members
drop policy if exists "farm_members_own" on public.farm_members;
create policy "farm_members_own" on public.farm_members
  for all to authenticated
  using (
    user_id = auth.uid()
    or farm_id in (select public.my_farm_ids())
  )
  with check (farm_id in (select public.my_farm_ids()));

-- plots
drop policy if exists "plots_via_farm" on public.plots;
create policy "plots_via_farm" on public.plots
  for all to authenticated
  using (farm_id in (select public.my_farm_ids()))
  with check (farm_id in (select public.my_farm_ids()));

-- machines
drop policy if exists "machines_via_farm" on public.machines;
create policy "machines_via_farm" on public.machines
  for all to authenticated
  using (farm_id in (select public.my_farm_ids()))
  with check (farm_id in (select public.my_farm_ids()));

-- inventory_items
drop policy if exists "inventory_items_via_farm" on public.inventory_items;
create policy "inventory_items_via_farm" on public.inventory_items
  for all to authenticated
  using (farm_id in (select public.my_farm_ids()))
  with check (farm_id in (select public.my_farm_ids()));

-- inventory_transactions
drop policy if exists "inventory_transactions_via_farm" on public.inventory_transactions;
create policy "inventory_transactions_via_farm" on public.inventory_transactions
  for all to authenticated
  using (farm_id in (select public.my_farm_ids()))
  with check (farm_id in (select public.my_farm_ids()));

-- operations
drop policy if exists "operations_via_farm" on public.operations;
create policy "operations_via_farm" on public.operations
  for all to authenticated
  using (farm_id in (select public.my_farm_ids()))
  with check (farm_id in (select public.my_farm_ids()));

-- operation_inputs
drop policy if exists "operation_inputs_via_farm" on public.operation_inputs;
create policy "operation_inputs_via_farm" on public.operation_inputs
  for all to authenticated
  using (
    operation_id in (
      select id from public.operations
      where farm_id in (select public.my_farm_ids())
    )
  )
  with check (
    operation_id in (
      select id from public.operations
      where farm_id in (select public.my_farm_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- 9. SETUP INICIAL — cria fazenda e vincula o primeiro usuário
-- Substitua 'SEU-USER-ID-AQUI' pelo UUID do seu usuário
-- (Supabase → Authentication → Users → copie o UUID)
-- ---------------------------------------------------------------------------

/*
do $$
declare
  v_user_id  uuid := 'SEU-USER-ID-AQUI';
  v_farm_id  uuid;
begin
  insert into public.farms (name, owner_id)
  values ('Minha Fazenda', v_user_id)
  returning id into v_farm_id;

  insert into public.farm_members (farm_id, user_id, role)
  values (v_farm_id, v_user_id, 'admin')
  on conflict do nothing;

  raise notice 'OK — farm_id: %', v_farm_id;
end;
$$;
*/
