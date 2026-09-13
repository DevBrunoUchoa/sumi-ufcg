const stage = (id, title, status = 'not_started', deadline = '', justification = '', partners = '') => ({ id, title, status, deadline, justification, partners });
const action = (id, code, title, stages, owner = 'SEPLAN', deadline = '2026-12-15') => ({ id, code, title, owner, deadline, tasks: stages });
const history = (text, actor = 'SEPLAN') => [{ id: `history-${Math.random().toString(16).slice(2)}`, at: '2026-09-08T14:30:00-03:00', text, actor }];
const measurement = (year, value, note, evidence = '') => [{ id: `result-${year}-${String(value)}`, year, value, note, at: '2026-09-08T14:30:00-03:00', evidence }];
const risk = (id, actionId, stageName, title, probability, impact, owner, details = {}) => ({
  id, actionId, stage: stageName, title, probability, impact, owner,
  strategicRisk: details.strategicRisk || 'Comprometimento do resultado institucional.',
  cause: details.cause || 'Dependência de informações e articulação entre setores.',
  consequence: details.consequence || 'Atraso na execução da ação planejada.',
  category: details.category || 'Operacional', controls: details.controls || 'Acompanhamento periódico do setor responsável.',
  controlType: details.controlType || 'Preventivo', maturity: details.maturity || 'Fraco', response: details.response || 'Mitigar',
  treatment: details.treatment || 'Revisar o cronograma e formalizar as responsabilidades.', treatmentOwner: details.treatmentOwner || owner,
  deadline: details.deadline || '2026-12-31', execution: details.execution ?? 0, situation: details.situation || 'Não iniciada',
  review: details.review || 'Trimestral', status: details.status || 'Ativo',
});

export const templates = [
  { id: 'pdi', type: 'PDI', name: 'Desenvolvimento institucional', version: 2, description: 'Objetivos, iniciativas, indicadores, metas anuais, ações e etapas.', labels: { axis: 'Eixo', objective: 'Objetivo', item: 'Iniciativa' }, defaultPeriodicity: 'annual', fields: [] },
  { id: 'pls', type: 'PLS', name: 'Logística sustentável', version: 2, description: 'Objetivos, metas, indicadores, ações e entregas de sustentabilidade.', labels: { axis: 'Eixo', objective: 'Objetivo', item: 'Meta' }, defaultPeriodicity: 'final', fields: [] },
];

const pdiAxes = [
  { id: 'pdi-axis-8', code: '8', name: 'Governança e Gestão Institucional', color: '#2f78a5', ownerUnit: 'SEPLAN', managerIds: ['dev-contributor'], reviewerIds: ['dev-reviewer'] },
];

const pdiObjectives = [
  { id: 'pdi-objective-8-1', axisId: 'pdi-axis-8', code: '8.1', title: 'Aperfeiçoar Práticas de Governança Pública' },
  { id: 'pdi-objective-8-2', axisId: 'pdi-axis-8', code: '8.2', title: 'Aperfeiçoar Práticas de Gestão Institucional' },
];

const pdiItems = [
  {
    id: 'riscos', code: '8.1.3', axisId: 'pdi-axis-8', objectiveId: 'pdi-objective-8-1',
    title: 'Elaborar o Plano de Gestão de Riscos da UFCG', owner: 'SEPLAN', partners: 'Setores da UFCG',
    description: 'Estruturar a gestão de riscos da instituição com participação dos setores e capacitação dos gestores.',
    source: 'PDI 2026–2030 · Eixo 8 · Iniciativa 8.1.3', reviewStatus: 'changes_requested', reviewNote: 'Detalhar o novo prazo da etapa atrasada.',
    metric: { name: 'Etapas concluídas da elaboração', measurementMode: 'stages', valueType: 'percentage', unit: '%', periodicity: 'annual', baseline: 0, reference: 'Linha de base do PDI', direction: 'up', targets: { 2026: 80, 2027: 100, 2028: null, 2029: null, 2030: null }, formula: 'Etapas concluídas ÷ total de etapas × 100' },
    measurements: [], extras: {},
    actions: [
      action('comissao', '8.1.3.1', 'Criar comissão para instituição do Plano de Gestão de Riscos', [
        stage('setores', 'Definir os setores participantes', 'completed', '2026-08-20'),
        stage('membros', 'Solicitar a indicação dos membros', 'completed', '2026-08-28'),
        stage('minuta', 'Elaborar a minuta da portaria', 'in_progress', '2026-09-05', 'A minuta aguarda a consolidação das contribuições da Reitoria.'),
        stage('aprovacao', 'Encaminhar para aprovação', 'not_started', '2026-10-15'),
        stage('publicacao', 'Publicar o ato de constituição', 'not_started', '2026-11-10'),
      ], 'SEPLAN', '2026-11-30'),
      action('estrutura', '8.1.3.2', 'Estabelecer a Estrutura de Gestão de Riscos da UFCG', [stage('normas', 'Levantar normas e referências', 'not_started', '2026-10-30'), stage('modelo', 'Propor o modelo de acompanhamento', 'not_started', '2026-12-10')]),
      action('capacitacao', '8.1.3.3', 'Capacitar Gestores e Lideranças da UFCG em Gestão de Riscos', [stage('publico', 'Definir o público e o conteúdo', 'not_started', '2026-10-20'), stage('realizar', 'Realizar a capacitação', 'not_started', '2026-12-05')]),
      action('politica', '8.1.3.4', 'Difundir o conhecimento sobre a Política de Gestão de Riscos', [stage('comunicacao', 'Preparar a comunicação para os setores', 'not_started', '2026-12-15')]),
    ],
    history: history('Acompanhamento devolvido para complementação da etapa atrasada.', 'Responsável pelo Eixo'),
    risks: [risk('risk-minuta', 'comissao', 'Elaborar a minuta da portaria', 'Atraso na consolidação da minuta de criação', 3, 3, 'SEPLAN')],
  },
  {
    id: 'rankings', code: '8.1.9', axisId: 'pdi-axis-8', objectiveId: 'pdi-objective-8-1',
    title: 'Aumentar a participação em rankings universitários nacionais e internacionais', owner: 'SEPLAN', partners: 'SPE',
    description: 'Ampliar a presença institucional em rankings universitários nacionais e internacionais.',
    source: 'PDI 2026–2030 · Eixo 8 · Iniciativa 8.1.9', reviewStatus: 'submitted', reviewNote: '',
    metric: { name: 'Número de rankings com participação da UFCG', measurementMode: 'manual', valueType: 'number', unit: 'rankings', periodicity: 'annual', baseline: 2, reference: 'Linha de base do PDI', direction: 'up', targets: { 2026: 4, 2027: 4, 2028: 4, 2029: 4, 2030: 4 }, formula: 'Número de rankings com participação no período' },
    measurements: measurement(2026, 3, 'Três participações registradas no período.'), extras: {},
    actions: [
      action('mapear', '8.1.9.1', 'Mapear os principais rankings universitários nacionais e internacionais', [stage('lista', 'Consolidar a lista de rankings', 'completed', '2026-08-30'), stage('criterios', 'Verificar os critérios de participação', 'in_progress', '2026-10-15')]),
      action('inscrever', '8.1.9.2', 'Fazer inscrições nos principais rankings universitários', [stage('dados', 'Reunir os dados institucionais', 'not_started', '2026-11-10'), stage('envio', 'Enviar as inscrições', 'not_started', '2026-12-10')]),
    ],
    history: history('Resultado de 2026 registrado: 3 rankings.', 'Gestor do Eixo'), risks: [risk('risk-rankings', 'inscrever', 'Enviar as inscrições', 'Dados institucionais incompletos para a inscrição', 3, 3, 'SEPLAN')],
  },
  {
    id: 'sustentabilidade', code: '8.2.3', axisId: 'pdi-axis-8', objectiveId: 'pdi-objective-8-2',
    title: 'Estabelecer práticas sustentáveis na UFCG', owner: 'SEPLAN', partners: 'PRGAF · Reitoria',
    description: 'Articular as ações institucionais de sustentabilidade com o Plano de Logística Sustentável.',
    source: 'PDI 2026–2030 · Eixo 8 · Iniciativa 8.2.3', reviewStatus: 'validated', reviewNote: '', linkedPlan: 'pls',
    metric: { name: 'Ações integradas ao PLS', measurementMode: 'manual', valueType: 'percentage', unit: '%', periodicity: 'annual', baseline: 0, reference: 'Acompanhamento institucional', direction: 'up', targets: { 2026: 20, 2027: 40, 2028: 60, 2029: 80, 2030: 100 }, formula: 'Ações integradas ÷ ações previstas × 100' },
    measurements: measurement(2026, 25, 'Integração inicial concluída.'), extras: {},
    actions: [action('integrar', '8.2.3.1', 'Integrar o acompanhamento das práticas sustentáveis ao PLS', [stage('mapear-pls', 'Mapear iniciativas relacionadas', 'completed', '2026-07-30'), stage('vincular-pls', 'Validar os vínculos com o PLS', 'in_progress', '2026-10-30')])],
    history: history('Vínculo com o PLS validado.'), risks: [],
  },
];

const plsAxes = [
  { id: 'pls-axis-1', code: '1', name: 'Promoção da racionalização e do consumo consciente de bens e serviços', color: '#4c8c68', ownerUnit: 'SEPLAN', managerIds: ['dev-contributor'], reviewerIds: ['dev-reviewer'] },
  { id: 'pls-axis-3', code: '3', name: 'Identificação dos objetos de menor impacto ambiental', color: '#7656a8', ownerUnit: 'PRGAF', managerIds: [], reviewerIds: ['dev-reviewer'] },
  { id: 'pls-axis-7', code: '7', name: 'Qualidade de vida', color: '#d29b18', ownerUnit: 'SRH', managerIds: [], reviewerIds: ['dev-reviewer'] },
];

const plsObjectives = [
  { id: 'pls-objective-1', axisId: 'pls-axis-1', code: '01', title: 'Reduzir o consumo de papel A4' },
  { id: 'pls-objective-2', axisId: 'pls-axis-1', code: '02', title: 'Promover práticas sustentáveis nas compras e contratações' },
  { id: 'pls-objective-11', axisId: 'pls-axis-3', code: '11', title: 'Incorporar critérios de menor impacto ambiental' },
  { id: 'pls-objective-27', axisId: 'pls-axis-7', code: '27', title: 'Alocar o servidor conforme o seu perfil profissional' },
];

const plsItems = [
  {
    id: 'papel', code: '01.1', axisId: 'pls-axis-1', objectiveId: 'pls-objective-1', title: 'Reduzir em 10% o consumo médio de papel A4 em relação à média 2024–2025', owner: 'PRGAF', partners: 'Direções de Centro', description: 'Acompanhar a redução do consumo institucional de papel A4.', source: 'PLS 2025–2030 · Objetivo 01', reviewStatus: 'validated', reviewNote: '',
    metric: { name: 'Consumo anual de papel A4', measurementMode: 'manual', valueType: 'number', unit: 'resmas', periodicity: 'annual', baseline: 1000, reference: 'Média de consumo 2024–2025', direction: 'down', targets: { 2025: null, 2026: 900, 2027: 900, 2028: 900, 2029: 900, 2030: 900 }, formula: 'Consumo anual ≤ média 2024–2025 × 0,9' },
    measurements: measurement(2026, 960, 'Consumo consolidado até o período.'), extras: {}, actions: [action('campanha', '01.1.1', 'Realizar campanha de consumo consciente', [stage('material', 'Preparar materiais de divulgação', 'completed', '2026-06-30'), stage('publicar', 'Publicar a campanha', 'in_progress', '2026-09-30')], 'PRGAF', '2026-10-30')], history: history('Resultado anual registrado.', 'PRGAF'), risks: [],
  },
  {
    id: 'politica-desfazimento', code: '02.1', axisId: 'pls-axis-1', objectiveId: 'pls-objective-2', title: 'Constituição de uma política de desfazimento de bens', owner: 'PRGAF', partners: 'SEPLAN', description: 'Construir e institucionalizar a política de desfazimento de bens da UFCG.', source: 'PLS 2025–2030 · Objetivo 02', reviewStatus: 'draft', reviewNote: '',
    metric: { name: 'Etapas concluídas da Política', measurementMode: 'stages', valueType: 'percentage', unit: '%', periodicity: 'final', baseline: 0, reference: 'Plano de ação do PLS', direction: 'up', targets: { 2030: 100 }, formula: 'Etapas concluídas ÷ total de etapas previstas × 100' },
    measurements: [], extras: {}, actions: [action('elaborar-politica', '02.1.1', 'Elaborar a política de desfazimento de bens', [stage('diagnostico', 'Realizar diagnóstico', 'completed', '2026-08-31'), stage('minuta-politica', 'Elaborar minuta da política', 'in_progress', '2026-12-15'), stage('aprovar-politica', 'Submeter a política para aprovação', 'not_started', '2027-06-30')], 'PRGAF', '2027-06-30')], history: history('Plano de ação iniciado.', 'PRGAF'), risks: [],
  },
  {
    id: 'guia-compras', code: '11.1', axisId: 'pls-axis-3', objectiveId: 'pls-objective-11', title: 'Elaboração de um guia de orientação sobre compras e licitações sustentáveis', owner: 'PRGAF', partners: 'SEPLAN', description: 'Produzir o guia institucional com critérios técnicos e ambientais.', source: 'PLS 2025–2030 · Objetivo 11', reviewStatus: 'submitted', reviewNote: '',
    metric: { name: 'Guia elaborado', measurementMode: 'delivery', valueType: 'status', unit: '', periodicity: 'final', baseline: 'not_started', reference: 'Entrega institucional prevista no PLS', direction: 'up', targets: { 2030: 'completed' }, completedValue: 'completed', formula: 'Situação da entrega validada pela área responsável' },
    measurements: measurement(2030, 'in_progress', 'Conteúdo técnico em elaboração.'), extras: {}, actions: [action('produzir-guia', '11.1.1', 'Elaborar o guia de compras sustentáveis', [stage('criterios-guia', 'Mapear critérios e práticas', 'completed', '2026-08-31'), stage('redacao-guia', 'Redigir o guia', 'in_progress', '2026-12-15'), stage('validacao-guia', 'Validar e publicar o guia', 'not_started', '2027-06-30')], 'PRGAF', '2027-06-30')], history: history('Entrega enviada para acompanhamento.', 'PRGAF'), risks: [],
  },
  {
    id: 'dimensionamento', code: '27.1', axisId: 'pls-axis-7', objectiveId: 'pls-objective-27', title: 'Aquisição e implementação de uma ferramenta de dimensionamento de postos de trabalho', owner: 'SRH', partners: 'STI · CASTA', description: 'Disponibilizar ferramenta para apoiar a alocação adequada de servidores.', source: 'PLS 2025–2030 · Objetivo 27', reviewStatus: 'draft', reviewNote: '',
    metric: { name: 'Ferramenta criada e implementada', measurementMode: 'delivery', valueType: 'status', unit: '', periodicity: 'final', baseline: 'not_started', reference: 'Entrega prevista no PLS', direction: 'up', targets: { 2030: 'completed' }, completedValue: 'completed', formula: 'Situação da entrega validada pela área responsável' },
    measurements: measurement(2030, 'not_started', 'Levantamento inicial ainda não concluído.'), extras: {}, actions: [action('ferramenta', '27.1.1', 'Desenvolver e implementar a ferramenta', [stage('mapear-postos', 'Mapear postos e perfis profissionais', 'not_started', '2026-12-31'), stage('desenvolver-ferramenta', 'Desenvolver a ferramenta', 'not_started', '2028-12-31'), stage('implantar-ferramenta', 'Implantar a ferramenta', 'not_started', '2030-12-31')], 'SRH', '2030-12-31')], history: history('Item incorporado ao acompanhamento do PLS.', 'SEPLAN'), risks: [],
  },
];

export function initialState() {
  return structuredClone({ version: 2, templates, plans: [
    { id: 'pdi', type: 'PDI', shortName: 'PDI', name: 'Plano de Desenvolvimento Institucional', start: 2026, end: 2030, status: 'published', template: templates[0], axes: pdiAxes, objectives: pdiObjectives, items: pdiItems },
    { id: 'pls', type: 'PLS', shortName: 'PLS', name: 'Plano Diretor de Logística Sustentável', start: 2025, end: 2030, status: 'published', template: templates[1], axes: plsAxes, objectives: plsObjectives, items: plsItems },
  ] });
}
