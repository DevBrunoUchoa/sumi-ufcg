# ADR 0003 — Stack do backend

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

### Organização do repositório: workspace pnpm com `backend/` na raiz

A ideia original desta ADR era um monorepo com prefixo `apps/` (`apps/api`).
Ao integrar este trabalho, a infraestrutura já tinha decidido (em paralelo,
PR `setup-infra`, ver ADR 0001 — "Monólito modular com workspace pnpm" do
time de infra) um layout plano, sem `apps/`: cada módulo direto na raiz
(`frontend/`, e agora `backend/`), registrado em `pnpm-workspace.yaml`, com
lockfile único e Dockerfile/CI já escritos assumindo esse layout. Adotamos a
convenção da infra em vez de manter `apps/api`, para não haver dois padrões
de estrutura coexistindo no mesmo repositório.

## Consequências

- CI atual só valida a instalação das dependências; falta acrescentar
  `pnpm --filter backend typecheck|build|test` como próximos passos (ver
  `docs/infrastructure.md` e o Dockerfile/CI da infra).
- Dockerfile/Compose da infra devem passar a copiar `backend/package.json` e
  buildar o pacote `backend`, do mesmo jeito que já fazem para `frontend/`
  (coordenar com quem está na infra — não foi ajustado nesta sessão).
- Módulos de domínio (planos, indicadores, riscos, auth) seguem a convenção
  de pastas descrita em `backend/src/modules/README.md`.
- Numeração de ADR: esta e a ADR de modelo de dados foram renumeradas para
  0003/0004 para não colidir com as ADRs 0001/0002 já usadas pela infra.
