# ADR 0005 — Integração do backend real com o frontend aprovado (workspace)

- **Status:** aceito
- **Data:** 2026-09-13

## Contexto

Em paralelo à implementação real do MVP (módulo `planos`, Sprint 1–2), o
time de frontend desenvolveu um protótipo navegável (`sumi-prototipo`) para
validar o layout com o produto/SEPLAN, com dados locais (mock) isolados em
`src/data.js` e um contrato HTTP já desenhado (`src/planning-client.js`,
`src/auth/session-client.js`) para quando o backend real estivesse pronto.
O protótipo foi aprovado. Esta ADR registra a integração desse frontend
com o backend e o Postgres/Supabase reais, substituindo os dados mockados.

O frontend aprovado espera:

```text
GET  /api/v1/auth/session
GET  /api/v1/planning/workspace
PUT  /api/v1/planning/workspace
```

e um modelo de dados fixo (`src/domain.js`, `WORKSPACE_VERSION = 2`):
plano → eixo → objetivo → item, com item carregando indicador (metric),
resultados (measurements), ações/etapas (actions/tasks), riscos (risks) e
histórico (history) — bem mais rico do que o motor genérico de
`tipo_plano`/`no_plano` (ADR 0002) foi desenhado para validar sozinho
(campos escalares por nível, fechado por `validarDados`).

## Decisão

### Onde cada parte do workspace é persistida

- **Eixo/objetivo/item continuam sendo nós de `no_plano`** (nivel 0/1/2) —
  o motor genérico já modela essa árvore corretamente. Os campos próprios
  de cada nível (code/name/color/ownerUnit/managerIds/reviewerIds no eixo;
  code/title no objetivo; code/title/owner/partners/description/source/
  reviewStatus/reviewNote/extras no item) vão em `dados` (jsonb), mas
  **validados pelo novo módulo `planning`** (`planning.schema.ts`, espelhando
  `src/domain.js`), não pelo `validarDados` fechado a `CampoDef` escalar de
  `planos.service.ts` — esse validador não modela arrays
  (`managerIds`/`reviewerIds`) nem o vocabulário fixo do workspace. O único
  uso que o módulo `planning` faz do esquema genérico é `tipo_plano.
  campos_extras` (`CampoDef[]`), para os "campos adicionais"
  configuráveis pelo administrador (`item.extras`) — esse é exatamente o
  caso para o qual `esquema_campos`/`CampoDef` foi desenhado.
- **Indicador, resultados, ações, etapas, riscos e histórico são recursos
  de um item** (nó nivel 2), não níveis adicionais da árvore — tabelas
  novas (`indicador`, `resultado`, `acao`, `etapa`, `risco`, `historico`)
  referenciando `no_plano.id` (ou `acao.id`, no caso de etapa/risco). Ver
  a migração `20260913120000_auth_workspace_engine.sql`.
- **`tipo_plano` ganhou colunas de metadado** (`tipo`, `versao`, `rotulos`,
  `periodicidade_padrao`, `campos_extras`) para representar o `template`
  que o frontend consome (nome amigável, sigla PDI/PLS, rótulos por
  nível, campos adicionais). O módulo `planos` original (`esquema_niveis`/
  `esquema_campos` para o CRUD genérico de tipo/nó) não foi alterado.

O módulo `planos` (Sprint 1–2, CRUD genérico de `tipo_plano`/`no_plano`)
segue existindo e funcionando como estava — o módulo `planning` é uma
camada adicional que lê/escreve as mesmas tabelas com um modelo de leitura
específico para o workspace, sem chamar `planosService` (que fecharia a
validação a `CampoDef` escalar e não serve para managerIds/reviewerIds).

### Autenticação e permissões

- **Sessão por cookie httpOnly opaco** (tabela `sessao`), não JWT — mais
  simples de revogar (basta apagar a linha) e não exige dependência nova.
  Senha com `scrypt` (`node:crypto`), sem dependência externa.
- **Só existe um papel global no banco**: `usuario.papel_admin`
  ("Administrador Estratégico"). **Gestor do Eixo** e **Responsável pelo
  Eixo** não são papéis próprios — são derivados da presença do
  `usuario.id` em `no_plano.dados.managerIds`/`reviewerIds` de cada eixo,
  exatamente como o próprio modelo de dados do frontend já representa
  ("O administrador pode configurar... as cores dos eixos", e o eixo já
  carrega `managerIds`/`reviewerIds`). Isso evita uma tabela de concessões
  paralela para manter sincronizada com o dado que já existe no eixo.
- **A composição exata de concessões por perfil não foi inventada nesta
  ADR** — ela já estava demonstrada em `dev/session-fixtures.js` do
  protótipo aprovado (as sessões de desenvolvimento simuladas). O backend
  (`backend/src/modules/auth/auth.service.ts`, `montarSessao`) reproduz
  fielmente essa composição a partir de dados reais. Em particular, isso
  responde várias das "decisões pendentes da SEPLAN" registradas em
  `docs/frontend.md`/`implementacao-frontend.md` do protótipo com o que já
  estava implícito nos exemplos: Gestor do Eixo tem `stage.update`,
  `result.create`, `item.submit` (mas não `action.manage`, `item.edit` nem
  `risk.manage` — não pode editar metadado do item, estrutura de
  ações/etapas nem riscos, só atualizar etapas e resultados existentes,
  submeter para validação); Responsável pelo Eixo tem só `item.review`
  (leitura + validar/devolver). Único ponto sem exemplo nos fixtures:
  `indicator.edit_target` (editar metas) ficou só para o administrador,
  por analogia com `item.edit`/`action.manage`/`risk.manage` (também não
  delegados a nenhum papel de eixo nos fixtures).

### Autorização na gravação (PUT /planning/workspace)

O frontend salva o workspace inteiro a cada mudança (debounce de 150ms). O
backend recalcula, por item, **o que mudou** (metadado básico, metas do
indicador, estrutura de ações/etapas vs. só status de etapa, resultados,
riscos, histórico, transição de `reviewStatus`) e exige, para cada
categoria alterada, a mesma permissão que o próprio frontend usa para
mostrar/esconder o controle correspondente
(`backend/src/modules/planning/planning.service.ts`, função `salvarItem`).
Isso mantém o servidor e a interface usando exatamente o mesmo vocabulário
de permissões — nenhuma regra nova foi inventada, só espelhada.

Esse diff por categoria é uma aproximação pragmática, não uma auditoria de
campo a campo exaustiva; simplificações conhecidas:

- Criar ou apagar um planejamento inteiro, ou alterar a estrutura de
  eixos/objetivos, exige `plan.manage` (administrador) — o PUT nunca
  apaga um plano inteiro ausente do payload (proteção deliberada contra
  perda de dados por um payload incompleto); apagar um plano exigiria uma
  ação explícita, fora do escopo desta integração.
- A atribuição de `managerIds`/`reviewerIds` de um eixo (quem é gestor ou
  responsável) só pode ser feita hoje via `plan.manage` (estrutura do
  plano) — **o protótipo aprovado não tem nenhuma tela para isso**
  (`StructureForm` cria eixos com `managerIds`/`reviewerIds` vazios e não
  os edita). Atribuir usuários a eixos, por ora, depende de escrever
  direto no banco ou de uma futura tela administrativa — não fabricamos
  uma aqui por estar fora do layout aprovado.

### Login

O protótipo aprovado não tem tela de login (só a simulação de perfis via
`/__dev/session/*`, exclusiva do servidor de desenvolvimento). Sem alguma
forma de autenticação real, nenhuma sessão autenticada chegaria à
aplicação. Foi adicionada uma tela mínima (`frontend/src/auth/Login.jsx`,
rota aditiva `#/login`, reaproveitando os componentes visuais existentes)
— nenhuma tela já aprovada foi alterada além de um link "Entrar"/"Sair" no
cabeçalho.

### Visibilidade pública

Por padrão, o protótipo filtra planos/seções internas no cliente
(`can(...)`). Como reforço — e para cumprir literalmente "consulta pública
não acessa riscos, histórico [...]" —, o backend também filtra no servidor:
planos em rascunho não aparecem para quem não tem `plan.read_internal`
nesse plano, e `risks`/`history` de um item vêm vazios para quem não tem
esse mesmo acesso no eixo do item.

## Consequências

- O módulo `planos` (Sprint 1–2) não foi modificado; o módulo `planning`
  é aditivo e usa as mesmas tabelas com uma leitura/escrita própria.
- `indicadores` e `riscos`, prometidos como módulos futuros no README de
  `backend/src/modules/README.md`, acabaram implementados como parte desta
  integração (tabelas `indicador`/`resultado` e `risco`) porque o
  workspace do frontend não faz sentido sem eles — o README dos módulos
  foi atualizado para refletir isso.
- Autenticação não usa nenhuma biblioteca nova (scrypt do `node:crypto`,
  cookie manual) — mantém a superfície de dependências do backend igual.
- Conteúdo institucional real do Eixo 8 do PDI (3 objetivos, 7 iniciativas,
  13 ações, 65 etapas e 65 riscos) foi extraído da planilha oficial
  "Monitoramento Eixo 8 — SEPLAN.xlsx" para
  `backend/scripts/data/eixo8-monitoramento-pdi.json` e é importado por
  `pnpm --filter backend importar-eixo8` (depois do `seed`) — ver
  `backend/scripts/importar-eixo8.ts`. Isso substitui os dados de exemplo
  do protótipo (que usa ids curtos como `"pdi-axis-8"`, incompatíveis com
  as colunas `uuid` do banco) pelo conteúdo real, sem inventar nada: cada
  campo do modelo (indicador, metas, ações, etapas, riscos) tem
  correspondência direta com uma coluna da planilha. Duas simplificações
  conhecidas na importação:
  - a planilha não tem prazo (`deadline`) por ação/etapa — os campos ficam
    vazios em vez de uma data fabricada;
  - a planilha tem mais colunas de risco do que o modelo atual suporta
    (custo previsto, datas reais de início/conclusão, lições aprendidas,
    ações corretivas, próxima revisão) — não incorporadas por exigirem
    estender `risco` e a tela de riscos do frontend aprovado, fora do
    escopo desta integração.
- O Plano de Negócio do SUMI (fornecido pela equipe) confirma o modelo de
  papéis/permissões já implementado (Administrador Estratégico, Gestor do
  Eixo, Responsável pelo Eixo) e a lógica de encadeamento
  eixo→objetivo→iniciativa→indicador→meta→ação→etapa→risco — nenhuma
  mudança de arquitetura foi necessária a partir dele.
