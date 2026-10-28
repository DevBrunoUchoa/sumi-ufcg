-- Row Level Security nas tabelas do SUMI
--
-- Só o backend acessa estas tabelas, sempre com a service role key, que
-- ignora RLS (ver backend/src/lib/supabase.ts) — o frontend nunca fala com
-- o Supabase. Por isso não há policies: RLS ligada sem nenhuma policy nega
-- tudo às roles da API (anon e authenticated) e não afeta a service role.
--
-- Isso importa no Supabase compartilhado da STI: a anon key é a mesma para
-- todos os sistemas e fica exposta no frontend deles. Sem RLS, qualquer um
-- com ela leria pela API sumi_usuario (hashes de senha) e sumi_sessao
-- (tokens de sessão).
--
-- Os revokes são uma segunda camada: tiram de anon e authenticated os
-- privilégios que o Supabase concede por padrão a todo objeto novo do
-- schema public. Fora do Supabase (sem essas roles), são pulados.

do $$
declare
  tabela text;
  papel text;
begin
  foreach tabela in array array[
    'sumi_tipo_plano', 'sumi_no_plano', 'sumi_usuario', 'sumi_sessao', 'sumi_indicador',
    'sumi_resultado', 'sumi_acao', 'sumi_etapa', 'sumi_risco', 'sumi_historico',
    'sumi_anexo', 'sumi_eixo_versao', 'sumi_redefinicao_senha'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    foreach papel in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = papel) then
        execute format('revoke all on table public.%I from %I', tabela, papel);
      end if;
    end loop;
  end loop;

  revoke execute on function public.sumi_arvore_no_plano(uuid) from public;
  foreach papel in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke execute on function public.sumi_arvore_no_plano(uuid) from %I', papel);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.sumi_arvore_no_plano(uuid) to service_role;
  end if;
end
$$;

notify pgrst, 'reload schema';
