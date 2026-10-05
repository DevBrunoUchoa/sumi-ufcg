# ADR 0006 — Navegação do PDI por eixo

- **Status:** implementado localmente
- **Data:** 2026-10-05

## Contexto

A entrada do PDI abria uma árvore de todos os eixos e selecionava a primeira iniciativa automaticamente. A navegação passa a apresentar os eixos como entradas, com uma página própria para seus objetivos e iniciativas. A cadeia PDI → eixo → objetivo → iniciativa → ação → etapas precisa permanecer explícita. Riscos continuam ligados à ação e, quando aplicável, a uma etapa.

## Decisão

- `#/plano/:planId` abre os eixos dos planos do tipo PDI. `#/plano/:planId/eixo/:axisId` abre um eixo. Objetivos agrupam iniciativas nessa página; `?objective=:id` permite voltar ao grupo de origem.
- Detalhes usam os mesmos parâmetros `item`, `view`, `period`, `action` e `stage` dentro do endereço do eixo. Endereços antigos do plano com esses parâmetros continuam válidos e inferem o eixo pela iniciativa. Identificadores são codificados; UUIDs não dependem dos nomes dos exemplos locais.
- O resolvedor valida as relações eixo/objetivo/iniciativa/ação/etapa. Um vínculo inexistente ou incompatível apresenta 404 em vez de selecionar outro item. Acesso direto a histórico ou riscos também exige a concessão correspondente.
- O shell, componentes e tokens GOV.BR, alto contraste e VLibras são reaproveitados. O PLS mantém seu explorador atual.
- Formulários, validação, anexos, indicadores, etapas, matriz de riscos, importação e persistência continuam usando os componentes e clientes existentes. A criação de uma iniciativa recebe o eixo e o objetivo do contexto. Mover uma iniciativa na edição atualiza seu endereço.
- `planning/navigation.js` concentra URLs e resolução. `planning/selectors.js` deriva filtros e resumos do workspace; `ScopeSummary` apresenta esses dados, separadamente da navegação. Esses limites permitem acrescentar painéis e gráficos por plano/eixo sem alterar as regras de autorização ou duplicar as regras dos indicadores.

## Integração e métricas

Não há alteração do contrato GET/PUT `/api/v1/planning/workspace`, das tabelas ou das permissões do backend. Navegar é uma operação de leitura; os resumos não são gravados. O resumo de execução conta etapas ativas concluídas (canceladas são excluídas), sem confundir esse percentual com atingimento de metas. Ausência de etapas ativas é apresentada como ausência de dados. Resumos de riscos não são expostos na consulta pública.

Testes do adaptador HTTP usam respostas interceptadas de sessão e workspace com UUIDs para verificar navegação sem PUT, gravação/recarregamento de etapas e importação no plano correto. Isso valida o contrato consumido pela interface, sem depender de um banco real.

## Extensão futura

Novas visualizações podem consumir os seletores ou endpoints agregados quando o volume justificar. Elas devem distinguir execução, resultado do indicador, meta e atingimento, explicitar o período e oferecer uma representação textual ou tabular acessível. Nenhuma biblioteca de gráficos nem visualização fictícia foi adicionada nesta mudança.
