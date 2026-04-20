-- =============================================================================
-- AGROMETA — Schema completo
-- Execute no SQL Editor do Supabase (Settings > SQL Editor)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELAS BASE
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'operator'
                check (role in ('admin', 'operator', 'viewer')),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.farms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.farm_members (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references public.farms(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'operator'
                check (role in ('admin', 'operator', 'viewer')),
  created_at  timestamptz not null default now(),
  unique (farm_id, user_id)
);

create table if not exists public.plots (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references public.farms(id) on delete cascade,
  name        text not null,
  variety     text,
  area_ha     numeric,
  cut_cycle   int default 1,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.machines (
  id                            uuid primary key default gen_random_uuid(),
  farm_id                       uuid not null references public.farms(id) on delete cascade,
  name                          text not null,
  type                          text not null
                                  check (type in ('trator','colheitadeira','moto','caminhao','pulverizador','grade','outro')),
  fuel_type                     text not null
                                  check (fuel_type in ('diesel','gasolina','flex','eletrico')),
  horimetro_atual               numeric not null default 0,
  horimetro_proxima_manutencao  numeric,
  placa                         text,
  created_at                    timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id                  uuid primary key default gen_random_uuid(),
  farm_id             uuid not null references public.farms(id) on delete cascade,
  name                text not null,
  category            text not null
                        check (category in ('adubo','calcario','diesel','gasolina','herbicida','inseticida','nutricional','outro')),
  sub_type            text,
  unit                text not null default 'kg',
  min_quantity        numeric not null default 0,
  batch_code          text,
  notes               text,
  quantidade_atual    numeric not null default 0,
  avg_price_per_unit  numeric not null default 0,
  ultima_movimentacao timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id                  uuid primary key default gen_random_uuid(),
  farm_id             uuid not null references public.farms(id) on delete cascade,
  item_id             uuid not null references public.inventory_items(id) on delete cascade,
  type                text not null check (type in ('entrada', 'saida')),
  quantity            numeric not null,
  valor_total_compra  numeric,
  custo_unitario      numeric,
  operation_id        uuid,
  created_by          uuid references auth.users(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now()
);

create table if not exists public.operations (
  id               uuid primary key default gen_random_uuid(),
  farm_id          uuid not null references public.farms(id) on delete cascade,
  plot_id          uuid references public.plots(id) on delete set null,
  machine_id       uuid references public.machines(id) on delete set null,
  operator_id      uuid references auth.users(id) on delete set null,
  type             text,
  activity_type    text,
  operation_date   date,
  quantity_used    numeric,
  unit             text,
  custo_operacao   numeric,
  horimetro_inicio numeric,
  horimetro_fim    numeric,
  started_at       timestamptz,
  ended_at         timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

create table if not exists public.operation_inputs (
  id             uuid primary key default gen_random_uuid(),
  operation_id   uuid not null references public.operations(id) on delete cascade,
  item_id        uuid not null references public.inventory_items(id) on delete cascade,
  quantity_used  numeric not null,
  custo_unitario numeric,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. VIEW: inventory_alerts
-- Exibe itens cujo quantidade_atual <= min_quantity (e min_quantity > 0)
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
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

-- 3a. Atualiza quantidade_atual e avg_price_per_unit após cada transação
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

  -- Preço médio ponderado apenas para entradas com custo informado
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

-- 3b. Atualiza horimetro_atual da máquina após operação
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

-- 3c. Cria perfil automaticamente quando um usuário se cadastra
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
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.farms              enable row level security;
alter table public.farm_members       enable row level security;
alter table public.plots              enable row level security;
alter table public.machines           enable row level security;
alter table public.inventory_items    enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.operations         enable row level security;
alter table public.operation_inputs   enable row level security;

-- Helper: retorna os farm_ids do usuário autenticado
create or replace function public.my_farm_ids()
returns setof uuid language sql stable security definer as $$
  select farm_id from public.farm_members where user_id = auth.uid();
$$;

-- profiles: cada usuário vê os perfis da sua fazenda
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_self"   on public.profiles;
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

-- operation_inputs (via operation)
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
-- 5. SETUP INICIAL (execute após criar o primeiro usuário via login)
-- Substitua 'SEU-USER-ID-AQUI' pelo UUID do seu usuário
-- (visível em Authentication > Users no painel do Supabase)
-- ---------------------------------------------------------------------------

/*
do $$
declare
  v_user_id  uuid := 'SEU-USER-ID-AQUI';
  v_farm_id  uuid;
begin
  -- Cria a fazenda
  insert into public.farms (name, owner_id)
  values ('Minha Fazenda', v_user_id)
  returning id into v_farm_id;

  -- Vincula o usuário como admin
  insert into public.farm_members (farm_id, user_id, role)
  values (v_farm_id, v_user_id, 'admin')
  on conflict do nothing;

  raise notice 'Fazenda criada: % — member OK', v_farm_id;
end;
$$;
*/
