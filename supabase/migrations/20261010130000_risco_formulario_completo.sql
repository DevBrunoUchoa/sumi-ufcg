alter table sumi_risco
  add column if not exists eixo text not null default '',
  add column if not exists objetivo text not null default '',
  add column if not exists ref_iniciativa text not null default '',
  add column if not exists iniciativa text not null default '',
  add column if not exists ref_acao text not null default '',
  add column if not exists acao_estrategica text not null default '',
  add column if not exists id_risco text not null default '',
  add column if not exists prazo_inicio date,
  add column if not exists custo_previsto numeric,
  add column if not exists etapa_concluida text not null default '',
  add column if not exists data_inicio_real date,
  add column if not exists data_conclusao_real date,
  add column if not exists justificativa text not null default '',
  add column if not exists data_proxima_revisao date,
  add column if not exists mudanca_processo text not null default '',
  add column if not exists novos_riscos text not null default '',
  add column if not exists acoes_corretivas text not null default '',
  add column if not exists licoes_aprendidas text not null default '';

create index if not exists sumi_risco_id_risco_idx on sumi_risco (id_risco);
