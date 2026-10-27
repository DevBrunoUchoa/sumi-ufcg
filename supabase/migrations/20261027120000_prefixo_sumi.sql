-- Prefixo sumi_ em todos os objetos do SUMI no banco
--
-- O Supabase da STI, onde o SUMI roda em produção, é compartilhado com
-- outros sistemas e tem um único banco. Nomes genéricos como `usuario`,
-- `sessao` ou `historico` colidiriam com tabelas de outros sistemas — e,
-- como as migrations usam `create table if not exists`, a colisão não daria
-- erro: o SUMI passaria a usar a tabela do outro sistema. Por isso as
-- migrations anteriores foram reescritas para já criar tudo com o prefixo
-- sumi_ (exceção deliberada à regra append-only — ver supabase/README.md).
--
-- Esta migration só serve para bancos criados antes dessa mudança (ex.: o
-- Supabase de desenvolvimento), que ainda têm os nomes sem prefixo: renomeia
-- tabelas, constraints, índices, triggers e funções, sem perder dados. Num
-- banco novo, onde as migrations anteriores já criaram sumi_no_plano, ela
-- não renomeia nada — e nunca toca em tabelas de outros sistemas.
--
-- Num banco antigo, rode SÓ esta migration: as anteriores já foram
-- aplicadas lá com os nomes antigos.

do $$
declare
  tabelas constant text[] := array[
    'tipo_plano', 'no_plano', 'usuario', 'sessao', 'indicador', 'resultado',
    'acao', 'etapa', 'risco', 'historico', 'anexo', 'eixo_versao', 'redefinicao_senha'
  ];
  tabela text;
  tabela_oid oid;
  r record;
begin
  if to_regclass('public.no_plano') is null or to_regclass('public.sumi_no_plano') is not null then
    raise notice 'Nada a renomear: o banco já usa o prefixo sumi_.';
    return;
  end if;

  foreach tabela in array tabelas loop
    tabela_oid := to_regclass(format('public.%I', tabela));
    continue when tabela_oid is null;

    -- Renomear a constraint de PK/unique renomeia junto o índice dela.
    for r in
      select conname from pg_constraint
      where conrelid = tabela_oid and conname not like 'sumi\_%'
    loop
      execute format('alter table public.%I rename constraint %I to %I', tabela, r.conname, 'sumi_' || r.conname);
    end loop;

    for r in
      select i.relname from pg_index x join pg_class i on i.oid = x.indexrelid
      where x.indrelid = tabela_oid and i.relname not like 'sumi\_%'
    loop
      execute format('alter index public.%I rename to %I', r.relname, 'sumi_' || r.relname);
    end loop;

    for r in
      select tgname from pg_trigger
      where tgrelid = tabela_oid and not tgisinternal and tgname not like 'sumi\_%'
    loop
      execute format('alter trigger %I on public.%I rename to %I', r.tgname, tabela, 'sumi_' || r.tgname);
    end loop;

    execute format('alter table public.%I rename to %I', tabela, 'sumi_' || tabela);
  end loop;

  -- Os triggers apontam para a função pelo oid: seguem funcionando.
  if to_regprocedure('public.set_atualizado_em()') is not null then
    alter function public.set_atualizado_em() rename to sumi_set_atualizado_em;
  end if;

  -- O corpo desta função cita a tabela pelo nome antigo; é recriada abaixo.
  drop function if exists public.arvore_no_plano(uuid);
end
$$;

-- Mesma definição de 20260831120000_planos_engine.sql.
create or replace function sumi_arvore_no_plano(raiz_id uuid)
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
    from sumi_no_plano np
    where np.id = raiz_id

    union all

    select np.*, s.profundidade + 1
    from sumi_no_plano np
    join subarvore s on np.no_pai_id = s.id
  )
  select id, tipo_plano_id, no_pai_id, nivel, ordem, dados, profundidade, criado_em, atualizado_em
  from subarvore
  order by profundidade, ordem;
$$;

-- A API do Supabase (PostgREST) guarda os nomes em cache.
notify pgrst, 'reload schema';
