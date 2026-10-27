-- Motor de autenticação e do workspace de planejamento (auth + indicadores + riscos)
--
-- Este arquivo NÃO altera o comportamento do módulo `planos` (sumi_tipo_plano /
-- sumi_no_plano) já implementado — só adiciona colunas de metadado ao sumi_tipo_plano
-- (usadas pelo módulo `planning` para montar o "template" consumido pelo
-- frontend aprovado) e tabelas novas.
--
-- Modelagem: eixo (nivel 0), objetivo (nivel 1) e item (nivel 2) continuam
-- sendo nós de `sumi_no_plano`, com seus campos próprios (code/title/owner/...)
-- guardados em `dados` — mas validados pelo módulo `planning`
-- (planning.schema.ts, espelhando src/domain.js do frontend aprovado), não
-- pelo validador genérico de `planos.service.ts` (que é fechado a
-- CampoDef escalares e não modela arrays como managerIds/reviewerIds).
-- `sumi_tipo_plano.campos_extras` continua sendo o único ponto onde o esquema
-- genérico de campos (CampoDef) é usado — para os "campos adicionais" que o
-- administrador configura por modelo (`item.extras` no frontend).
--
-- indicador/resultado/acao/etapa/risco/historico são recursos de um nó
-- item (nivel 2), não níveis adicionais da árvore — cada um referencia
-- diretamente `sumi_no_plano.id` (ou `sumi_acao.id`, no caso de etapa e risco).

alter table sumi_tipo_plano
  add column if not exists tipo text not null default '',
  add column if not exists versao integer not null default 1,
  add column if not exists rotulos jsonb not null default '{}'::jsonb,
  add column if not exists periodicidade_padrao text not null default 'annual',
  add column if not exists campos_extras jsonb not null default '[]'::jsonb;

alter table sumi_tipo_plano
  drop constraint if exists sumi_tipo_plano_periodicidade_padrao_valida;
alter table sumi_tipo_plano
  add constraint sumi_tipo_plano_periodicidade_padrao_valida
  check (periodicidade_padrao in ('annual', 'final'));

alter table sumi_tipo_plano
  drop constraint if exists sumi_tipo_plano_rotulos_e_objeto;
alter table sumi_tipo_plano
  add constraint sumi_tipo_plano_rotulos_e_objeto check (jsonb_typeof(rotulos) = 'object');

alter table sumi_tipo_plano
  drop constraint if exists sumi_tipo_plano_campos_extras_e_array;
alter table sumi_tipo_plano
  add constraint sumi_tipo_plano_campos_extras_e_array check (jsonb_typeof(campos_extras) = 'array');

comment on column sumi_tipo_plano.tipo is 'Sigla do tipo de plano exibida na interface (ex.: PDI, PLS).';
comment on column sumi_tipo_plano.versao is 'Incrementada a cada edição do modelo (rótulos/campos adicionais) — ver Models/TemplateForm no frontend.';
comment on column sumi_tipo_plano.rotulos is 'Rótulos apresentados por nível: { "axis": "Eixo", "objective": "Objetivo", "item": "Iniciativa" }.';
comment on column sumi_tipo_plano.campos_extras is 'CampoDef[] — campos adicionais configuráveis pelo administrador, aplicados a item.extras.';

-- ---------------------------------------------------------------------------
-- usuario / sessão
-- ---------------------------------------------------------------------------

create table if not exists sumi_usuario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,
  -- Único papel global do modelo: "Administrador Estratégico" (visão
  -- institucional completa). Gestor do Eixo / Responsável pelo Eixo não são
  -- papéis globais: são derivados de sumi_no_plano.dados.managerIds/reviewerIds
  -- de cada eixo (ver backend/src/modules/auth/auth.service.ts) — assim a
  -- atribuição de gestores/responsáveis por eixo fica no próprio dado do
  -- eixo, sem uma tabela de concessões paralela para reconciliar.
  papel_admin boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint sumi_usuario_email_unico unique (email)
);

drop trigger if exists sumi_usuario_set_atualizado_em on sumi_usuario;
create trigger sumi_usuario_set_atualizado_em
  before update on sumi_usuario
  for each row execute function sumi_set_atualizado_em();

create table if not exists sumi_sessao (
  token uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references sumi_usuario (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create index if not exists sumi_sessao_usuario_idx on sumi_sessao (usuario_id);

-- ---------------------------------------------------------------------------
-- indicador / resultado (item.metric / item.measurements)
-- ---------------------------------------------------------------------------

create table if not exists sumi_indicador (
  no_plano_id uuid primary key references sumi_no_plano (id) on delete cascade,
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
  constraint sumi_indicador_metas_e_objeto check (jsonb_typeof(metas) = 'object')
);

drop trigger if exists sumi_indicador_set_atualizado_em on sumi_indicador;
create trigger sumi_indicador_set_atualizado_em
  before update on sumi_indicador
  for each row execute function sumi_set_atualizado_em();

create table if not exists sumi_resultado (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references sumi_no_plano (id) on delete cascade,
  ano integer not null,
  valor jsonb,
  observacao text not null default '',
  em timestamptz not null default now(),
  evidencia text not null default ''
);

create index if not exists sumi_resultado_no_plano_idx on sumi_resultado (no_plano_id, ano);

-- ---------------------------------------------------------------------------
-- ação / etapa (item.actions / action.tasks)
-- ---------------------------------------------------------------------------

create table if not exists sumi_acao (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references sumi_no_plano (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  responsavel text not null default '',
  prazo date,
  ordem integer not null default 0
);

create index if not exists sumi_acao_no_plano_idx on sumi_acao (no_plano_id, ordem);

create table if not exists sumi_etapa (
  id uuid primary key default gen_random_uuid(),
  acao_id uuid not null references sumi_acao (id) on delete cascade,
  titulo text not null,
  situacao text not null default 'not_started'
    check (situacao in ('not_started', 'in_progress', 'completed', 'cancelled')),
  prazo date,
  justificativa text not null default '',
  parceiros text not null default '',
  ordem integer not null default 0
);

create index if not exists sumi_etapa_acao_idx on sumi_etapa (acao_id, ordem);

-- ---------------------------------------------------------------------------
-- risco (ForRisco — item.risks)
-- ---------------------------------------------------------------------------

create table if not exists sumi_risco (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references sumi_no_plano (id) on delete cascade,
  acao_id uuid references sumi_acao (id) on delete set null,
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

create index if not exists sumi_risco_no_plano_idx on sumi_risco (no_plano_id);
create index if not exists sumi_risco_acao_idx on sumi_risco (acao_id);

-- ---------------------------------------------------------------------------
-- histórico (item.history)
-- ---------------------------------------------------------------------------

create table if not exists sumi_historico (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references sumi_no_plano (id) on delete cascade,
  em timestamptz not null default now(),
  texto text not null,
  autor text not null
);

create index if not exists sumi_historico_no_plano_idx on sumi_historico (no_plano_id, em);

comment on table sumi_usuario is 'Usuários com credenciais no SUMI (login por e-mail/senha).';
comment on table sumi_sessao is 'Sessões ativas (token opaco em cookie httpOnly) — ver backend/src/modules/auth.';
comment on table sumi_indicador is 'Indicador de um item (nó nivel=2 de sumi_no_plano) — 1:1 com o nó.';
comment on table sumi_resultado is 'Registros de resultado (item.measurements) de um indicador, por ano.';
comment on table sumi_acao is 'Ações estratégicas de um item (item.actions).';
comment on table sumi_etapa is 'Etapas de uma ação (action.tasks).';
comment on table sumi_risco is 'Riscos (modelo ForRisco) vinculados a um item e, opcionalmente, a uma ação.';
comment on table sumi_historico is 'Linha do tempo de um item (item.history).';
