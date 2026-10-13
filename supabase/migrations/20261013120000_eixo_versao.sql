-- Histórico versionado de importações por eixo (período do PDI)
--
-- As unidades reimportam a planilha de monitoramento do eixo ao longo do
-- ano/ciclo, e cada reimportação substitui silenciosamente o conteúdo
-- anterior sem deixar rastro de "como estava antes" — só o histórico por
-- iniciativa (tabela `historico`) registra o que mudou, item a item, sem
-- reter a planilha original nem um retrato consolidado do eixo naquele
-- momento. Pedido explícito da coordenação: manter, por período (ano) do
-- plano, o arquivo original enviado e um retrato de cobertura de execução
-- e de riscos naquele ponto, como registro consultável — não editável.
--
-- O arquivo em si fica no bucket de storage "eixo-versoes" do Supabase
-- (privado — ver backend/scripts/criar-bucket-eixo-versoes.ts), igual ao
-- padrão já usado pelos anexos; esta tabela guarda só o metadado, o
-- caminho e o retrato numérico.

create table if not exists eixo_versao (
  id uuid primary key default gen_random_uuid(),
  eixo_id uuid not null references no_plano (id) on delete cascade,
  -- Ano do ciclo do plano a que esta importação se refere — hoje sempre o
  -- ano corrente no momento da importação, limitado à vigência do plano
  -- (plan.start..plan.end); ver importacao.service.ts.
  periodo integer not null,
  arquivo_nome text not null,
  arquivo_tipo_mime text not null,
  arquivo_tamanho_bytes integer not null,
  arquivo_caminho_storage text not null,
  itens_criados integer not null default 0,
  itens_atualizados integer not null default 0,
  -- Proporção de etapas ativas concluídas no eixo logo após esta importação
  -- (mesma métrica de "Execução das etapas" já usada em outras telas) —
  -- não é atingimento de meta/indicador, é cobertura de execução.
  cobertura_execucao_percentual numeric not null default 0,
  riscos_total integer not null default 0,
  enviado_por text not null,
  enviado_em timestamptz not null default now(),
  constraint eixo_versao_caminho_storage_unico unique (arquivo_caminho_storage)
);

create index if not exists eixo_versao_eixo_idx on eixo_versao (eixo_id, periodo, enviado_em);

comment on table eixo_versao is 'Uma linha por importação de planilha bem-sucedida: arquivo original retido + retrato de cobertura de execução e total de riscos do eixo naquele momento, associado ao período (ano) do ciclo do plano.';
