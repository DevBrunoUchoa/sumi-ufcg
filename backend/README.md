# backend

Backend do SUMI-UFCG (Express + TypeScript), acessando o Postgres do
Supabase via `@supabase/supabase-js`. Decisões e alternativas consideradas em
[`docs/adr/0003-stack-backend.md`](../docs/adr/0003-stack-backend.md).

## Uso

```bash
cp .env.example .env   # preencher SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
pnpm --filter backend dev
```

- `pnpm --filter backend dev` — desenvolvimento com reload automático
- `pnpm --filter backend typecheck` — checagem de tipos
- `pnpm --filter backend build` / `start` — build de produção e execução
- `pnpm --filter backend test` — testes (vitest)
- `pnpm --filter backend seed` — cria os modelos PDI/PLS, os dois planos e o
  usuário administrador (variáveis `SEED_*`, ver `.env.example`)
- `pnpm --filter backend importar-eixo8` — importa o conteúdo real do Eixo 8
  do PDI (`scripts/data/eixo8-monitoramento-pdi.json`, extraído da planilha
  "Monitoramento Eixo 8 — SEPLAN.xlsx") para dentro do plano PDI já criado
  pelo `seed`; idempotente, pode rodar de novo para atualizar

## Estrutura

```
src/
  index.ts        # entrypoint (sobe o servidor HTTP)
  app.ts           # composição do Express (middlewares, rotas)
  config/env.ts    # validação de variáveis de ambiente (Zod)
  lib/             # logger, cliente Supabase, HttpError (lib/http-error.ts)
  middlewares/     # error handler, etc.
  routes/          # rotas sem domínio próprio (ex.: /health)
  modules/         # módulos de domínio — ver modules/README.md
```

As migrations SQL do banco (tabelas usadas por este backend) ficam em
[`supabase/migrations`](../supabase/migrations), na raiz do repositório —
ver [`supabase/README.md`](../supabase/README.md) para como aplicá-las.
