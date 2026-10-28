-- Buckets do SUMI fechados para a API pública
--
-- Os arquivos de todos os buckets ficam numa tabela só, storage.objects, e
-- as policies de storage são RLS nessa tabela. No Supabase compartilhado da
-- STI, uma policy de outro sistema que não filtre por bucket_id (ex.:
-- "leitura para qualquer usuário autenticado") valeria também para os
-- buckets do SUMI.
--
-- Esta policy é restritiva: o Postgres a combina com AND às policies
-- permissivas, então nenhuma delas consegue abrir sumi-anexos ou
-- sumi-eixo-versoes para anon ou authenticated. O backend usa a service
-- role, que ignora RLS, e não é afetado; os buckets dos outros sistemas
-- também não.
--
-- Fora do Supabase (sem o schema storage), não faz nada.

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Sem storage.objects: nada a fazer fora do Supabase.';
    return;
  end if;

  drop policy if exists sumi_buckets_so_backend on storage.objects;
  create policy sumi_buckets_so_backend on storage.objects
    as restrictive
    for all
    to anon, authenticated
    using (bucket_id not in ('sumi-anexos', 'sumi-eixo-versoes'))
    with check (bucket_id not in ('sumi-anexos', 'sumi-eixo-versoes'));
end
$$;
