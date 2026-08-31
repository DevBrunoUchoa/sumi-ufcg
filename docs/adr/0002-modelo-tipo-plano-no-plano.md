# ADR 0002 — Modelo de dados: tipo_plano e nó_plano

- **Status:** aceito
- **Data:** 2026-08-31

## Contexto

Sprint 1 (24–28/ago) e Sprint 2 (31/ago–04/set) do cronograma do MVP pedem,
sob responsabilidade do Dev A (backend): modelar `tipo_plano` e `nó_plano`
(árvore recursiva) e validar o modelo com os dados reais do PDI Eixo 8
(`Monitoramento Eixo 8 – SEPLAN.xlsx`), depois expor CRUD via API.

A planilha real mostra uma hierarquia fixa de 5 níveis para o PDI: **Eixo →
Objetivo → Iniciativa → Ação Estratégica → Etapa**, com campos específicos em
cada nível (ex.: iniciativa tem indicador/linha de base/metas anuais; etapa
tem "concluída?" e "% execução"). O objetivo do produto, porém, é que
`tipo_plano` seja genérico — outros tipos de plano (não só o PDI) devem poder
definir sua própria quantidade de níveis e campos, sem alterar schema/código.

## Decisão

### `tipo_plano`
- `esquema_niveis`: array ordenado (`{ ordem, chave, rotulo }`), ordem
  0-based e sequencial — valida a profundidade e o rótulo de cada nível.
- `esquema_campos`: mapa `chave_do_nível -> CampoDef[]`, onde `CampoDef`
  define `chave`, `rotulo`, `tipo` (texto/texto_longo/numero/percentual/
  data/booleano/selecao), `obrigatorio` e `opcoes` (quando `tipo=selecao`).
- Chave reservada **`raiz`**: campos do próprio nó-raiz da árvore (a
  instância do plano, ex. "PDI UFCG 2026-2030"), já que esse nó não faz
  parte de `esquema_niveis` (que descreve apenas níveis internos, nivel ≥ 0).

### `nó_plano`
- Lista de adjacência (`no_pai_id`), não materialized path/ltree — mais
  simples de implementar e suficiente para o volume esperado (uma árvore de
  plano institucional tem no máximo algumas centenas de nós).
- `nivel = -1` no nó-raiz (`no_pai_id IS NULL`) representa a instância do
  plano; `nivel = 0, 1, 2...` indexa `tipo_plano.esquema_niveis`.
- `dados` (jsonb) é validado no service (`planos.service.ts`,
  `validarDados`) contra os `CampoDef` do nível do nó antes de gravar —
  tanto na criação quanto na atualização. Campos não definidos no esquema
  são rejeitados (schema fechado), não apenas ignorados, para evitar dados
  "soltos" fora do modelo combinado com o time de produto/SEPLAN.
- Consulta de subárvore completa via função SQL `arvore_no_plano(raiz_id)`
  (CTE recursiva) exposta como RPC do Supabase — `supabase-js` não expressa
  CTEs recursivas (risco já previsto no ADR 0001).
- **Mover/reordenar** (`POST /nos-plano/:id/mover`) só permite trocar de pai
  quando o novo pai está no **mesmo nível** do pai atual. Mover para um nível
  diferente exigiria recalcular `nivel` (e revalidar `dados`) de toda a
  subárvore movida — fora do escopo do Sprint 2; se isso vier a ser
  necessário, tratar em uma migração de dados / endpoint dedicado, não como
  efeito colateral de um "mover" simples.
- Nó com filhos não pode ser removido via API (bloco em `removerNoPlano`,
  409) — evita apagar subárvore inteira por engano; exclusão em cascata fica
  para uma decisão de produto futura (ex.: endpoint explícito de "excluir
  com todos os descendentes").

## Validação com dados reais (PDI Eixo 8)

O `esquema_niveis` de 5 posições (eixo/objetivo/iniciativa/ação
estratégica/etapa) e os campos usados nos testes automatizados
(`planos.service.test.ts`) espelham as colunas da aba "MONITORAMENTO PDI" da
planilha da SEPLAN (Eixo, Objetivo do PDI, Iniciativa + indicador/linha de
base/metas 2026-2030, Ação Estratégica, Etapa + execução %). O modelo
comporta a estrutura real sem ajustes adicionais. A carga efetiva desses
dados no banco (seed do PDI Eixo 8) é tarefa do Dev B na Sprint 2, não desta
ADR.

## Consequências

- Qualquer novo tipo de plano (não só PDI) pode ser cadastrado sem migração
  de schema, apenas criando uma nova linha em `tipo_plano`.
- `esquema_niveis`/`esquema_campos` de um `tipo_plano` **não são editáveis**
  via `PATCH /tipos-plano/:id` (só `nome`, `descricao`, `ativo`) — mudar a
  estrutura de um tipo já em uso invalidaria os nós existentes; se isso for
  necessário, será uma decisão explícita e uma migração de dados, não um
  PATCH comum.
