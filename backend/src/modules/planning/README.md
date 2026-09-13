# planning

Agrega o workspace consumido pelo frontend aprovado
(`GET/PUT /api/v1/planning/workspace`) — ver
[`docs/adr/0005-integracao-workspace-real.md`](../../../../docs/adr/0005-integracao-workspace-real.md).

```
planning.types.ts       # Workspace/Plan/Axis/Objective/Item/... (espelha src/domain.js do frontend)
planning.schema.ts       # validação Zod do payload do PUT (espelha validateWorkspace de src/domain.js)
planning.repository.ts   # leitura em bloco de tipo_plano/no_plano/indicador/resultado/acao/etapa/risco/historico
planning.service.ts      # montagem do GET, reconciliação + autorização por permissão do PUT
planning.routes.ts       # GET/PUT /api/v1/planning/workspace
```

## Modelo

- Eixo/objetivo/item continuam sendo nós de `no_plano` (reaproveita o
  motor do módulo `planos`), mas a validação de `dados` é a própria
  (`planning.schema.ts`), não `planos.service.ts` (fechado a `CampoDef`
  escalar — não modela `managerIds`/`reviewerIds`).
- Indicador, resultados, ações, etapas, riscos e histórico são tabelas
  próprias referenciando o item (`no_plano.id`) ou a ação (`acao.id`).

## Autorização no PUT

Por item, o service calcula o que mudou (metadado básico, metas, estrutura
de ações/etapas vs. status de etapa, resultados, riscos, histórico,
transição de `reviewStatus`) e exige a mesma permissão que o frontend usa
para mostrar o controle equivalente. Ver a ADR para as simplificações
conhecidas dessa abordagem.
