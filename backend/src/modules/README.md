# Módulos de domínio

Cada módulo de domínio segue a mesma convenção de pastas, mantendo rotas,
regras de negócio e acesso a dados separados:

```
modules/<dominio>/
  <dominio>.routes.ts      # Router do Express, monta os endpoints HTTP
  <dominio>.schema.ts       # Schemas Zod (validação de entrada/saída)
  <dominio>.service.ts      # Regras de negócio
  <dominio>.repository.ts   # Acesso a dados via supabase-js (lib/supabase.ts)
  <dominio>.types.ts        # Tipos específicos do domínio (quando necessário)
```

O router de cada módulo é montado em `app.ts`.

## Módulos

- **planos** ✅ implementado (Sprint 1–2) — motor genérico de planos:
  `tipo_plano` (esquema de níveis e campos em JSON) e `nó_plano` (árvore
  recursiva: nó_pai_id, nível, dados em JSON). Ver `planos/README.md` e
  `docs/adr/0002-persistencia-postgresql-com-supabase.md` /
  `docs/adr/0004-modelo-tipo-plano-no-plano.md`.
- **auth** ✅ implementado — sessão por cookie, login/logout, cálculo de
  concessões (papel_admin + managerIds/reviewerIds dos eixos). Ver
  `auth/README.md`.
- **planning** ✅ implementado — agrega o workspace consumido pelo
  frontend aprovado (`GET/PUT /api/v1/planning/workspace`): eixo/
  objetivo/item (via `no_plano`, reaproveitando o motor de `planos`) mais
  indicador/resultado/ação/etapa/risco/histórico (tabelas próprias). Ver
  `planning/README.md`.
- **indicadores** / **riscos** — implementados como parte de `planning`
  (não como módulos à parte) — ver os READMEs dessas pastas.

Ver `docs/adr/0005-integracao-workspace-real.md` para as decisões da
integração com o frontend real e do modelo de autenticação/permissões.
