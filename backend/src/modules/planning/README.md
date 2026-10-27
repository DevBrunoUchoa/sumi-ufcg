# planning

Agrega o workspace consumido pelo frontend aprovado
(`GET/PUT /api/v1/planning/workspace`) — ver
[`docs/adr/0005-integracao-workspace-real.md`](../../../../docs/adr/0005-integracao-workspace-real.md).

```
planning.types.ts       # Workspace/Plan/Axis/Objective/Item/... (espelha src/domain.js do frontend)
planning.schema.ts       # validação Zod do payload do PUT (espelha validateWorkspace de src/domain.js)
planning.repository.ts   # leitura em bloco de sumi_tipo_plano/sumi_no_plano/sumi_indicador/sumi_resultado/sumi_acao/sumi_etapa/sumi_risco/sumi_historico
planning.service.ts      # montagem do GET, reconciliação + autorização por permissão do PUT
planning.routes.ts       # GET/PUT /api/v1/planning/workspace
```

## Modelo

- Eixo/objetivo/item continuam sendo nós de `sumi_no_plano` (reaproveita o
  motor do módulo `planos`), mas a validação de `dados` é a própria
  (`planning.schema.ts`), não `planos.service.ts` (fechado a `CampoDef`
  escalar — não modela `managerIds`/`reviewerIds`).
- Indicador, resultados, ações, etapas, riscos e histórico são tabelas
  próprias referenciando o item (`sumi_no_plano.id`) ou a ação (`sumi_acao.id`).

## Autorização no PUT

Por item, o service calcula o que mudou (metadado básico, metas, estrutura
de ações/etapas vs. status de etapa, resultados, riscos, histórico,
transição de `reviewStatus`) e exige a mesma permissão que o frontend usa
para mostrar o controle equivalente. Ver a ADR para as simplificações
conhecidas dessa abordagem.

A comparação de conteúdo preserva a semântica JSON e ignora a ordem das
chaves de objetos JSONB. Uma lista de riscos ou histórico ocultada no GET
por falta de permissão não significa exclusão no PUT: o serviço conserva os
registros e os vínculos às ações. Alterações explícitas em riscos continuam
exigindo `risk.manage`; ações com riscos ocultos não podem ser removidas.
### Vínculos ODS

`Objective.ods` é opcional. Quando ausente em uma gravação, preserva o cadastro
existente; `[]` remove os vínculos explicitamente. Apenas `plan.manage` permite
alterar essa parte da estrutura. A leitura mantém a ausência do campo nos
objetivos legados, permitindo a referência documental do frontend. Não há
migração ou preenchimento automático do banco durante consultas.

