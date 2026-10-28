# Migrations

SQL puro (sem ORM), aplicado diretamente no Postgres do Supabase — decisão
registrada em [`docs/adr/0003-stack-backend.md`](../docs/adr/0003-stack-backend.md).

```
migrations/
  20260831120000_planos_engine.sql             # sumi_tipo_plano + sumi_no_plano (motor de planos)
  20260913120000_auth_workspace_engine.sql     # usuários, sessões, indicadores, ações, etapas, riscos, histórico
  20260914120000_anexos.sql                    # sumi_anexo
  20261010130000_risco_formulario_completo.sql # colunas do formulário completo de risco
  20261013120000_eixo_versao.sql               # sumi_eixo_versao (versões das importações)
  20261013130000_redefinicao_senha.sql         # sumi_redefinicao_senha
  20261027120000_prefixo_sumi.sql              # converte bancos antigos para o prefixo sumi_
  20261028120000_rls_sumi.sql                  # RLS sem policies: a API pública não acessa nada
```

## RLS

Só o backend acessa o banco, sempre com a service role key, que ignora RLS;
o frontend nunca fala com o Supabase. Por isso as tabelas têm RLS ligada e
**nenhuma policy**: `anon` e `authenticated` não leem nem gravam nada, e o
backend funciona normalmente. Num Supabase compartilhado isso é o que impede
quem tem a anon key de outro sistema de ler `sumi_usuario` ou `sumi_sessao`.

## Prefixo `sumi_`

Todo objeto do SUMI no banco — tabelas, funções, índices, constraints e
triggers — leva o prefixo `sumi_`, e os buckets de storage o prefixo `sumi-`
(`sumi-anexos`, `sumi-eixo-versoes`). O Supabase da STI, onde o SUMI roda em
produção, é compartilhado com outros sistemas e tem um único banco; sem o
prefixo, nomes como `usuario` ou `historico` colidiriam com os de outros
sistemas.

## Banco novo

Rode todos os arquivos em ordem (a de prefixo não faz nada num banco novo).
Pelo SQL Editor do painel do Supabase, colando um arquivo por vez, ou via
`psql` com a connection string do projeto (Settings → Database):

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

Depois, com o `backend/.env` apontando para esse Supabase, crie os buckets e
os dados iniciais (usuário administrador, modelos PDI/PLS e os planos-base;
ver `backend/scripts/seed.ts`):

```bash
pnpm --filter backend criar-bucket
pnpm --filter backend criar-bucket-eixo-versoes
SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... pnpm --filter backend seed
```

Em produção, os mesmos comandos rodam dentro do container, que já tem o
pnpm e os scripts:

```bash
docker compose exec app pnpm --filter backend criar-bucket
docker compose exec app pnpm --filter backend criar-bucket-eixo-versoes
docker compose exec -e SEED_ADMIN_EMAIL=... -e SEED_ADMIN_PASSWORD=... app pnpm --filter backend seed
```

## Banco criado antes do prefixo

Rode `20261027120000_prefixo_sumi.sql` e as que vêm depois dela (não as
anteriores): ela renomeia tabelas, constraints, índices, triggers e funções
sem perder dados. Os buckets novos
precisam ser criados com os comandos acima; os arquivos que já estavam nos
buckets antigos (`anexos`, `eixo-versoes`) não são movidos.

## Convenção

- Um arquivo por migração, prefixado com timestamp (`YYYYMMDDHHMMSS_descricao.sql`).
- Migrações são append-only: uma alteração de schema já aplicado vira uma
  nova migração, nunca uma edição retroativa do arquivo existente.
- Exceção única: a introdução do prefixo `sumi_` reescreveu as migrations
  anteriores, porque rodá-las com os nomes antigos num banco compartilhado já
  causaria a colisão que o prefixo evita. Os bancos antigos convergem para o
  mesmo schema pela `20261027120000_prefixo_sumi.sql`.
