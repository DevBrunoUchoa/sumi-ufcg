-- Motor de autenticação e do workspace de planejamento (auth + indicadores + riscos)
--
-- Este arquivo NÃO altera o comportamento do módulo `planos` (tipo_plano /
-- no_plano) já implementado — só adiciona colunas de metadado ao tipo_plano
-- (usadas pelo módulo `planning` para montar o "template" consumido pelo
-- frontend aprovado) e tabelas novas.
--
-- Modelagem: eixo (nivel 0), objetivo (nivel 1) e item (nivel 2) continuam
-- sendo nós de `no_plano`, com seus campos próprios (code/title/owner/...)
-- guardados em `dados` — mas validados pelo módulo `planning`
-- (planning.schema.ts, espelhando src/domain.js do frontend aprovado), não
-- pelo validador genérico de `planos.service.ts` (que é fechado a
-- CampoDef escalares e não modela arrays como managerIds/reviewerIds).
-- `tipo_plano.campos_extras` continua sendo o único ponto onde o esquema
-- genérico de campos (CampoDef) é usado — para os "campos adicionais" que o
-- administrador configura por modelo (`item.extras` no frontend).
--
-- indicador/resultado/acao/etapa/risco/historico são recursos de um nó
-- item (nivel 2), não níveis adicionais da árvore — cada um referencia
-- diretamente `no_plano.id` (ou `acao.id`, no caso de etapa e risco).

alter table tipo_plano
  add column if not exists tipo text not null default '',
  add column if not exists versao integer not null default 1,
  add column if not exists rotulos jsonb not null default '{}'::jsonb,
  add column if not exists periodicidade_padrao text not null default 'annual',
  add column if not exists campos_extras jsonb not null default '[]'::jsonb;

alter table tipo_plano
  drop constraint if exists tipo_plano_periodicidade_padrao_valida;
alter table tipo_plano
  add constraint tipo_plano_periodicidade_padrao_valida
  check (periodicidade_padrao in ('annual', 'final'));

alter table tipo_plano
  drop constraint if exists tipo_plano_rotulos_e_objeto;
alter table tipo_plano
  add constraint tipo_plano_rotulos_e_objeto check (jsonb_typeof(rotulos) = 'object');

alter table tipo_plano
  drop constraint if exists tipo_plano_campos_extras_e_array;
alter table tipo_plano
  add constraint tipo_plano_campos_extras_e_array check (jsonb_typeof(campos_extras) = 'array');

comment on column tipo_plano.tipo is 'Sigla do tipo de plano exibida na interface (ex.: PDI, PLS).';
comment on column tipo_plano.versao is 'Incrementada a cada edição do modelo (rótulos/campos adicionais) — ver Models/TemplateForm no frontend.';
comment on column tipo_plano.rotulos is 'Rótulos apresentados por nível: { "axis": "Eixo", "objective": "Objetivo", "item": "Iniciativa" }.';
comment on column tipo_plano.campos_extras is 'CampoDef[] — campos adicionais configuráveis pelo administrador, aplicados a item.extras.';

-- ---------------------------------------------------------------------------
-- usuario / sessão
-- ---------------------------------------------------------------------------

create table if not exists usuario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,
  -- Único papel global do modelo: "Administrador Estratégico" (visão
  -- institucional completa). Gestor do Eixo / Responsável pelo Eixo não são
  -- papéis globais: são derivados de no_plano.dados.managerIds/reviewerIds
  -- de cada eixo (ver backend/src/modules/auth/auth.service.ts) — assim a
  -- atribuição de gestores/responsáveis por eixo fica no próprio dado do
  -- eixo, sem uma tabela de concessões paralela para reconciliar.
  papel_admin boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint usuario_email_unico unique (email)
);

drop trigger if exists usuario_set_atualizado_em on usuario;
create trigger usuario_set_atualizado_em
  before update on usuario
  for each row execute function set_atualizado_em();

create table if not exists sessao (
  token uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create index if not exists sessao_usuario_idx on sessao (usuario_id);

-- ---------------------------------------------------------------------------
-- indicador / resultado (item.metric / item.measurements)
-- ---------------------------------------------------------------------------

create table if not exists indicador (
  no_plano_id uuid primary key references no_plano (id) on delete cascade,
  nome text not null,
  modo_medicao text not null check (modo_medicao in ('manual', 'delivery', 'stages')),
  tipo_valor text not null check (tipo_valor in ('number', 'percentage', 'status')),
  unidade text not null default '',
  periodicidade text not null check (periodicidade in ('annual', 'final')),
  linha_base jsonb,
  referencia text not null default '',
  direcao text not null check (direcao in ('up', 'down')),
  metas jsonb not null default '{}'::jsonb,
  formula text not null default '',
  valor_concluido jsonb,
  atualizado_em timestamptz not null default now(),
  constraint indicador_metas_e_objeto check (jsonb_typeof(metas) = 'object')
);

drop trigger if exists indicador_set_atualizado_em on indicador;
create trigger indicador_set_atualizado_em
  before update on indicador
  for each row execute function set_atualizado_em();

create table if not exists resultado (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references no_plano (id) on delete cascade,
  ano integer not null,
  valor jsonb,
  observacao text not null default '',
  em timestamptz not null default now(),
  evidencia text not null default ''
);

create index if not exists resultado_no_plano_idx on resultado (no_plano_id, ano);

-- ---------------------------------------------------------------------------
-- ação / etapa (item.actions / action.tasks)
-- ---------------------------------------------------------------------------

create table if not exists acao (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references no_plano (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  responsavel text not null default '',
  prazo date,
  ordem integer not null default 0
);

create index if not exists acao_no_plano_idx on acao (no_plano_id, ordem);

create table if not exists etapa (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null references acao (id) on delete cascade,
  titulo text not null,
  situacao text not null default 'not_started'
    check (situacao in ('not_started', 'in_progress', 'completed', 'cancelled')),
  prazo date,
  justificativa text not null default '',
  parceiros text not null default '',
  ordem integer not null default 0
);

create index if not exists etapa_acao_idx on etapa (acao_id, ordem);

-- ---------------------------------------------------------------------------
-- risco (ForRisco — item.risks)
-- ---------------------------------------------------------------------------

create table if not exists risco (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references no_plano (id) on delete cascade,
  acao_id uuid references acao (id) on delete set null,
  etapa_nome text not null default '',
  titulo text not null,
  probabilidade integer not null check (probabilidade between 1 and 5),
  impacto integer not null check (impacto between 1 and 5),
  responsavel text not null default '',
  risco_estrategico text not null default '',
  causa text not null default '',
  consequencia text not null default '',
  categoria text not null default '',
  controles text not null default '',
  tipo_controle text not null default '',
  maturidade text not null default '',
  resposta text not null default '',
  tratamento text not null default '',
  responsavel_tratamento text not null default '',
  prazo date,
  execucao numeric not null default 0,
  situacao text not null default '',
  revisao text not null default '',
  status text not null default ''
);

create index if not exists risco_no_plano_idx on risco (no_plano_id);
create index if not exists risco_acao_idx on risco (acao_id);

-- ---------------------------------------------------------------------------
-- histórico (item.history)
-- ---------------------------------------------------------------------------

create table if not exists historico (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references no_plano (id) on delete cascade,
  em timestamptz not null default now(),
  texto text not null,
  autor text not null
);

create index if not exists historico_no_plano_idx on historico (no_plano_id, em);

comment on table usuario is 'Usuários com credenciais no SUMI (login por e-mail/senha).';
comment on table sessao is 'Sessões ativas (token opaco em cookie httpOnly) — ver backend/src/modules/auth.';
comment on table indicador is 'Indicador de um item (nó nivel=2 de no_plano) — 1:1 com o nó.';
comment on table resultado is 'Registros de resultado (item.measurements) de um indicador, por ano.';
comment on table acao is 'Ações estratégicas de um item (item.actions).';
comment on table etapa is 'Etapas de uma ação (action.tasks).';
comment on table risco is 'Riscos (modelo ForRisco) vinculados a um item e, opcionalmente, a uma ação.';
comment on table historico is 'Linha do tempo de um item (item.history).';
