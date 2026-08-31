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
