# indicadores

Implementado — mas não como um módulo `indicadores/` à parte. Indicador
(`item.metric`) e resultados (`item.measurements`) do frontend aprovado
viraram as tabelas `indicador`/`resultado`, lidas e gravadas por
`../planning` junto com o resto do workspace de um item (eixo/objetivo/
item, ações/etapas, riscos, histórico) — que é como o frontend aprovado
consome os dados (`GET/PUT /api/v1/planning/workspace`), não por recursos
separados por domínio.

Ver [`docs/adr/0005-integracao-workspace-real.md`](../../../../docs/adr/0005-integracao-workspace-real.md)
e `../planning/planning.service.ts`.
