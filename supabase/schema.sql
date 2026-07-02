-- ============================================================
-- Tres Manantiales · Esquema de base de datos para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

create table if not exists config (
  id int primary key default 1,
  hectareas numeric not null default 0,
  constraint config_singleton check (id = 1)
);
insert into config (id, hectareas) values (1, 850)
  on conflict (id) do nothing;

create table if not exists propiedades (
  id bigint generated always as identity primary key,
  nombre text not null,
  tipo text not null,
  created_at timestamptz default now()
);

create table if not exists animales (
  id bigint generated always as identity primary key,
  tipo text not null,
  nombre text not null,
  edad numeric not null default 0,
  sexo text not null,
  created_at timestamptz default now()
);

create table if not exists stock (
  id bigint generated always as identity primary key,
  cat text not null check (cat in ('animal','despensa')),
  item text not null,
  cant numeric not null default 0,
  unidad text not null default 'unid.',
  min numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists gastos (
  id bigint generated always as identity primary key,
  categoria text not null,
  tipo text not null check (tipo in ('Fijo','Variable')),
  descripcion text not null,
  monto numeric not null default 0,
  fecha date not null default current_date,
  created_at timestamptz default now()
);

create table if not exists vehiculos (
  id bigint generated always as identity primary key,
  tipo text not null,
  modelo text not null,
  identificacion text not null,
  estado text not null default 'Operativo',
  created_at timestamptz default now()
);

create table if not exists medicamentos (
  id bigint generated always as identity primary key,
  nombre text not null,
  cant numeric not null default 0,
  min numeric not null default 0,
  vencimiento date,
  created_at timestamptz default now()
);

create table if not exists veterinarios (
  id bigint generated always as identity primary key,
  nombre text not null,
  telefono text,
  direccion text,
  created_at timestamptz default now()
);

-- ============================================================
-- Datos iniciales (opcional, borrar si no los querés)
-- ============================================================
insert into propiedades (nombre, tipo) values
  ('Casa del dueño','Vivienda'),
  ('Casa del peón','Vivienda'),
  ('Galpón de reparación de vehículos','Galpón'),
  ('Galpón de conservación y desposte','Galpón'),
  ('Casa de despensa','Depósito');

-- ============================================================
-- Seguridad (RLS)
-- Esta app es de uso interno/privado. Para simplificar el primer
-- deploy se habilita acceso completo con la clave "anon".
-- ANTES de compartir la URL públicamente, reemplazá estas políticas
-- por autenticación real (Supabase Auth) — ver README.md.
-- ============================================================
alter table config enable row level security;
alter table propiedades enable row level security;
alter table animales enable row level security;
alter table stock enable row level security;
alter table gastos enable row level security;
alter table vehiculos enable row level security;
alter table medicamentos enable row level security;
alter table veterinarios enable row level security;

create policy "acceso_total_config" on config for all using (true) with check (true);
create policy "acceso_total_propiedades" on propiedades for all using (true) with check (true);
create policy "acceso_total_animales" on animales for all using (true) with check (true);
create policy "acceso_total_stock" on stock for all using (true) with check (true);
create policy "acceso_total_gastos" on gastos for all using (true) with check (true);
create policy "acceso_total_vehiculos" on vehiculos for all using (true) with check (true);
create policy "acceso_total_medicamentos" on medicamentos for all using (true) with check (true);
create policy "acceso_total_veterinarios" on veterinarios for all using (true) with check (true);
