# ADR 0001 — Stack do backend

- **Status:** aceito
- **Data:** 2026-08-25

## Contexto

O MVP do SUMI-UFCG precisa ser entregue em ~5,8 semanas (24/ago a 1/out/2026),
com 3 desenvolvedores. A infraestrutura já definida pelo time (Node 24, pnpm
11, Supabase como banco/serviço gerenciado) está registrada em
`docs/infrastructure.md`. Faltava decidir o framework HTTP, a forma de acesso
ao Postgres do Supabase e a organização do repositório para o código do
backend.

## Decisão

### Framework HTTP: Express

Optou-se por Express por ser o framework mais conhecido da equipe, com maior
volume de exemplos e documentação prontos — reduzindo risco de aprendizado
dentro do prazo apertado do MVP. A ausência de estrutura/validação nativas é
compensada com convenções fixadas neste repositório (ver
`src/modules/README.md`) e Zod para validação de entrada/saída e de variáveis
de ambiente (`src/config/env.ts`).

Alternativas consideradas: NestJS (mais estrutura pronta, porém mais
boilerplate e curva de aprendizado — risco para o prazo), Fastify e Hono
(mais leves, porém menos familiares à equipe).

### Acesso a dados: `supabase-js` (cliente oficial), sem ORM

O backend acessa o Postgres do Supabase diretamente via `@supabase/supabase-js`
autenticado com a service role key (`src/lib/supabase.ts`), em vez de um ORM
como Prisma ou Drizzle. Reduz uma camada de setup (migrations/schema
duplicado) no início do projeto; o modelo de dados (tipo_plano/nó_plano em
árvore, indicadores, riscos) será mantido diretamente nas migrations do
projeto Supabase.

**Consequência a monitorar:** consultas recursivas (árvore de nó_plano) e
joins mais complexos (risco × avaliação × controle) podem exigir functions/
views no Postgres ou RPC do Supabase, já que o cliente não oferece query
builder relacional tipado. Revisar esta decisão se a complexidade das
queries do módulo de riscos/indicadores crescer muito.

A service role key nunca deve ser usada fora do backend (ignora Row Level
Security).

### Organização do repositório: monorepo com `apps/api`

Criado `pnpm-workspace.yaml` apontando para `apps/*`, com o backend em
`apps/api`. Ainda que hoje só exista uma aplicação, essa estrutura evita uma
reorganização disruptiva quando o frontend (Dev B) for iniciado, e mantém o
CI (`.github/workflows/repository.yml`) compatível — `pnpm install
--frozen-lockfile` na raiz já resolve todos os workspaces.

## Consequências

- CI atual só valida a instalação das dependências; falta acrescentar
  `pnpm --filter @sumi-ufcg/api typecheck|build|test` como próximos passos
  (ver `docs/infrastructure.md`).
- Dockerfile/Compose (ainda não criados) devem buildar a partir de
  `apps/api`, gerando uma única unidade de implantação para o monólito,
  conforme já registrado em `docs/infrastructure.md`.
- Módulos de domínio (planos, indicadores, riscos, auth) seguem a convenção
  de pastas descrita em `apps/api/src/modules/README.md`.
