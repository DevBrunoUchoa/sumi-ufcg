-- Anexos (documentos de execução e comprovação de resultado)
--
-- Cobre duas capacidades do Plano de Negócio do SUMI que faltavam:
-- "Anexar documentos" (Gestor do Eixo, Módulo 3 — Execução) e comprovação
-- de meta no registro de resultado. Um anexo sempre pertence a um item
-- (no_plano_id), e opcionalmente a uma etapa ou a um resultado específico
-- — os dois lugares concretos de onde o frontend permite anexar.
--
-- O arquivo em si fica no bucket de storage "sumi-anexos" do Supabase (privado
-- — ver backend/scripts/criar-bucket-anexos.ts), não no Postgres; esta
-- tabela guarda só o metadado e o caminho (`caminho_storage`).

create table if not exists sumi_anexo (
  id uuid primary key default gen_random_uuid(),
  no_plano_id uuid not null references sumi_no_plano (id) on delete cascade,
  etapa_id uuid references sumi_etapa (id) on delete cascade,
  resultado_id uuid references sumi_resultado (id) on delete cascade,
  nome_arquivo text not null,
  tipo_mime text not null,
  tamanho_bytes integer not null,
  caminho_storage text not null,
  enviado_por text not null,
  enviado_em timestamptz not null default now(),
  constraint sumi_anexo_caminho_storage_unico unique (caminho_storage)
);

create index if not exists sumi_anexo_no_plano_idx on sumi_anexo (no_plano_id);
create index if not exists sumi_anexo_etapa_idx on sumi_anexo (etapa_id);
create index if not exists sumi_anexo_resultado_idx on sumi_anexo (resultado_id);

comment on table sumi_anexo is 'Documentos anexados a um item, etapa ou resultado — arquivo real fica no bucket de storage "sumi-anexos".';
