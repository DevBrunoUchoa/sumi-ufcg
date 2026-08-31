# Migrations

SQL puro (sem ORM), aplicado diretamente no Postgres do Supabase — decisão
registrada em [`docs/adr/0001-stack-backend.md`](../docs/adr/0001-stack-backend.md).

```
migrations/
  20260831120000_planos_engine.sql   # tipo_plano + nó_plano (motor de planos)
```

## Aplicar localmente

Com a Supabase CLI configurada no projeto (fora do escopo desta sessão —
combinar com quem está cuidando da infraestrutura):

```bash
supabase db push
```

Sem a CLI, dá para aplicar direto via `psql` usando a connection string do
projeto Supabase (Settings → Database), executando os arquivos em ordem:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260831120000_planos_engine.sql
```

## Convenção

- Um arquivo por migração, prefixado com timestamp (`YYYYMMDDHHMMSS_descricao.sql`).
- Migrações são append-only: uma alteração de schema já aplicado vira uma
  nova migração, nunca uma edição retroativa do arquivo existente.
