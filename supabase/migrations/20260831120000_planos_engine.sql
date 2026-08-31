-- Motor de planos: tipo_plano + nó_plano (árvore recursiva)
--
-- tipo_plano define, para um tipo de plano institucional (ex.: PDI 2026-2030),
-- quantos níveis a árvore tem e quais campos cada nível aceita.
-- nó_plano é a árvore em si (lista de adjacência via no_pai_id): a raiz
-- (no_pai_id IS NULL) representa a instância do plano (ex.: "PDI UFCG
-- 2026-2030"); cada nível abaixo é definido por esquema_niveis do tipo_plano
-- (ex.: Eixo -> Objetivo -> Iniciativa -> Ação Estratégica -> Etapa).

create extension if not exists pgcrypto;

create table if not exists tipo_plano (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  -- Array ordenado de níveis: [{ "ordem": 0, "chave": "eixo", "rotulo": "Eixo" }, ...]
  esquema_niveis jsonb not null,
  -- Campos aceitos por nível: { "eixo": [{ "chave": "titulo", "rotulo": "Título", "tipo": "texto", "obrigatorio": true }], ... }
  esquema_campos jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint tipo_plano_nome_unico unique (nome),
  constraint tipo_plano_esquema_niveis_e_array check (jsonb_typeof(esquema_niveis) = 'array'),
  constraint tipo_plano_esquema_campos_e_objeto check (jsonb_typeof(esquema_campos) = 'object')
);

create table if not exists no_plano (
  id uuid primary key default gen_random_uuid(),
  tipo_plano_id uuid not null references tipo_plano (id) on delete restrict,
  no_pai_id uuid references no_plano (id) on delete cascade,
  -- Índice (0-based) em tipo_plano.esquema_niveis; raiz (no_pai_id null) = instância do plano, nivel = -1.
  nivel integer not null,
  ordem integer not null default 0,
  -- Valores dos campos definidos em tipo_plano.esquema_campos para este nível.
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint no_plano_raiz_sem_pai check ((no_pai_id is null) = (nivel = -1)),
  constraint no_plano_dados_e_objeto check (jsonb_typeof(dados) = 'object'),
  constraint no_plano_nao_e_proprio_pai check (id is distinct from no_pai_id)
);

create index if not exists no_plano_pai_idx on no_plano (no_pai_id, ordem);
create index if not exists no_plano_tipo_plano_idx on no_plano (tipo_plano_id);

-- Mantém atualizado_em em dia em qualquer UPDATE.
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists tipo_plano_set_atualizado_em on tipo_plano;
create trigger tipo_plano_set_atualizado_em
  before update on tipo_plano
  for each row execute function set_atualizado_em();

drop trigger if exists no_plano_set_atualizado_em on no_plano;
create trigger no_plano_set_atualizado_em
  before update on no_plano
  for each row execute function set_atualizado_em();

-- Retorna toda a subárvore (incluindo a própria raiz) a partir de um nó,
-- ordenada por profundidade e por 'ordem' entre irmãos. supabase-js não
-- expressa CTEs recursivas, então essa consulta é exposta como RPC
-- (supabase.rpc('arvore_no_plano', { raiz_id })).
create or replace function arvore_no_plano(raiz_id uuid)
returns table (
  id uuid,
  tipo_plano_id uuid,
  no_pai_id uuid,
  nivel integer,
  ordem integer,
  dados jsonb,
  profundidade integer,
  criado_em timestamptz,
  atualizado_em timestamptz
)
language sql
stable
as $$
  with recursive subarvore as (
    select np.*, 0 as profundidade
    from no_plano np
    where np.id = raiz_id

    union all

    select np.*, s.profundidade + 1
    from no_plano np
    join subarvore s on np.no_pai_id = s.id
  )
  select id, tipo_plano_id, no_pai_id, nivel, ordem, dados, profundidade, criado_em, atualizado_em
  from subarvore
  order by profundidade, ordem;
$$;

comment on table tipo_plano is 'Define os níveis e o esquema de campos de um tipo de plano institucional (ex.: PDI).';
comment on table no_plano is 'Árvore recursiva de um plano concreto (lista de adjacência via no_pai_id).';
