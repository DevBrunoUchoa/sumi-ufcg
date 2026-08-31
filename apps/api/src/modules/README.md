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
  `docs/adr/0002-modelo-tipo-plano-no-plano.md`.
- **indicadores** — previsto para a Sprint 3 — `indicador` / `meta_anual`
  (linha de base, metas por ano, execução %), vinculados a um nó_plano.
- **riscos** — previsto para a Sprint 4 — modelo ForRisco: `risco`,
  `avaliação_risco` (P×I), `controle`, `resposta_risco`, `revisão_risco`.
- **auth** — responsabilidade da infra (Dev C), Sprint 2 — `usuário` /
  `papel` / `setor`, autenticação e escopo de permissão (RBAC) sobre os
  módulos acima.

Ver `docs/contexto-projeto.md` (Claude Project) para o detalhamento do
modelo de dados e o vocabulário herdado do ForRisco/ForPDI.
