/** Somente arquivos locais: não carrega .env, sessão, Supabase ou serviços HTTP. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { lerAbaPdi, lerAbaRiscos } from '../src/modules/planning/importacao.leitura.js';
import { workspaceSchema } from '../src/modules/planning/planning.schema.js';
import type { Item, Plan, Workspace } from '../src/modules/planning/planning.types.js';
import { initialState } from '../../frontend/src/data.js';
import { executionStatus, validateWorkspace } from '../../frontend/src/domain.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const input = resolve(root, process.argv[2] || 'docs_locais');
const output = resolve(root, '.local-preview');
const at = '2026-10-05T12:00:00-03:00';
const tag = 'Cenário local de teste';
const id = (kind: string, key: string) => `local-${kind}-${createHash('sha256').update(key).digest('hex').slice(0, 20)}`;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const numeric = (value: string) => {
  const text = value.trim().replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
};
const history = (key: string, text: string, date = at) => ({ id: id('history', key), at: date, actor: 'Prévia local', text });

interface Preview { revision: string; at: string; counts: Record<string, number>; label: string }
const workspace = workspaceSchema.parse(initialState()) as Workspace & { localPreview?: Preview };
const plan = workspace.plans.find((p) => p.id === 'pdi')! as Plan & { localPreview?: Preview };
const originalItems = plan.items;
plan.items = [];
plan.objectives = [];
const sources: object[] = [];
const warnings: string[] = [];
const files = [
  ...(await readdir(resolve(input, 'eixos'))).filter((name) => name.endsWith('.xlsx')).map((name) => resolve(input, 'eixos', name)),
  ...(await readdir(input)).filter((name) => /^Monitoramento Eixo.*\.xlsx$/i.test(name)).map((name) => resolve(input, name)),
].sort((a, b) => a.localeCompare(b, 'pt-BR'));
if (!files.length) throw new Error('Nenhuma planilha local encontrada.');

for (const file of files) {
  const bytes = await readFile(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = book.worksheets.find((s) => /monitoramento/i.test(s.name) && !/risco/i.test(s.name));
  if (!sheet) throw new Error(`Sem monitoramento: ${file}`);
  const riskSheet = book.worksheets.find((s) => /gerenciamento/i.test(s.name) && /risco/i.test(s.name));
  const unit = file.match(/ - ([^.]+)\.xlsx$/)?.[1] || sheet.name.split(' - ')[0] || 'Unidade local';
  const source = relative(root, file).replaceAll('\\', '/');
  // Respeita o formato percentual do Excel (0,25 com numFmt '%' = 25%).
  // Fórmulas sem resultado em cache ficam ausentes: nenhuma fórmula é executada.
  for (const worksheet of [sheet, riskSheet].filter(Boolean) as ExcelJS.Worksheet[]) {
    worksheet.eachRow((row) => row.eachCell((cell) => {
      if (cell.isMerged && cell.master !== cell) return;
      const value = cell.value;
      if (value instanceof Date) cell.value = value.toISOString().slice(0, 10);
      else if (typeof value === 'object' && value && ('formula' in value || 'sharedFormula' in value)) {
        const result = 'result' in value ? value.result : undefined;
        cell.value = typeof result === 'number' && cell.numFmt?.includes('%') ? `${Number((result * 100).toFixed(6))}%` : result ?? '';
      } else if (typeof value === 'number' && cell.numFmt?.includes('%')) cell.value = `${Number((value * 100).toFixed(6))}%`;
    }));
  }
  const parsed = lerAbaPdi(sheet);
  const risks = riskSheet ? lerAbaRiscos(riskSheet) : [];
  const axis = plan.axes.find((axis) => axis.code === parsed.eixoCodigo);
  if (!axis) throw new Error(`Eixo inválido: ${source}`);
  axis.ownerUnit = axis.ownerUnit === 'A definir' ? unit : [...new Set([...axis.ownerUnit.split(' · '), unit])].join(' · ');
  sources.push({ file: source, sha256: createHash('sha256').update(bytes).digest('hex'), unit, axis: axis.code, items: parsed.itens.size, risks: risks.length });
  for (const imported of parsed.itens.values()) {
    if (plan.items.some((item) => item.code === imported.itemCodigo)) throw new Error(`Iniciativa duplicada entre fontes: ${imported.itemCodigo}`);
    let objective = plan.objectives.find((o) => o.axisId === axis.id && o.code === imported.objetivoCodigo);
    if (!objective) {
      objective = { id: `pdi-objective-${imported.objetivoCodigo.replaceAll('.', '-')}`, axisId: axis.id, code: imported.objetivoCodigo, title: imported.objetivoTitulo };
      plan.objectives.push(objective);
    }
    const legacy = originalItems.find((item) => item.code === imported.itemCodigo);
    const percentage = /%|percentual/i.test(imported.indicador) || /%/.test(imported.linhaBase) || Object.values(imported.metas).some((m) => m.includes('%'));
    const byStages = percentage && /etapas (?:conclu[ií]das|de aprimoramento)/i.test(imported.indicador);
    const targets = Object.fromEntries(Object.entries(imported.metas).map(([year, raw]) => {
      const value = numeric(raw);
      if (value === null && !/^[-—–\s]*$/.test(raw)) warnings.push(`${imported.itemCodigo}/${year}: meta textual '${raw}' preservada na referência; sem comparação numérica automática.`);
      return [year, value];
    }));
    const item: Item = {
      id: legacy?.id || id('item', imported.itemCodigo), code: imported.itemCodigo, axisId: axis.id, objectiveId: objective.id,
      title: imported.itemTitulo, owner: unit, partners: '', description: `Iniciativa de ${unit}, conforme a matriz local de monitoramento do PDI.`,
      source, reviewStatus: 'draft', reviewNote: '', ...(legacy?.linkedPlan ? { linkedPlan: legacy.linkedPlan } : {}),
      metric: { name: imported.indicador, measurementMode: byStages ? 'stages' : 'manual', valueType: percentage ? 'percentage' : 'number', unit: percentage ? '%' : '', periodicity: 'annual',
        baseline: numeric(imported.linhaBase), reference: `Fonte: ${source}. Metas originais: ${Object.entries(imported.metas).map(([year, raw]) => `${year}: ${raw}`).join('; ')}.`, direction: 'up', targets, formula: imported.indicador },
      measurements: [], extras: { localSource: source, localBaseline: imported.linhaBase, localTargets: JSON.stringify(imported.metas), localExecution: JSON.stringify(imported.execucoes) },
      actions: [...imported.acoes].map(([code, action]) => {
        if (!code.startsWith(`${imported.itemCodigo}.`)) throw new Error(`Ação fora de sua iniciativa: ${code}`);
        const seen = new Set<string>();
        return { id: id('action', code), code, title: action.titulo, owner: unit, deadline: '', tasks: action.etapas.filter((stage) => {
          const key = normalize(stage.title); if (seen.has(key)) return false; seen.add(key); return true;
        }).map((stage, i) => ({ ...stage, id: id('stage', `${code}:${i}:${normalize(stage.title)}`) })) };
      }),
      risks: [], history: [history(`source:${imported.itemCodigo}`, `Estrutura, metas e riscos carregados de ${source}. Valores de execução da planilha preservados separadamente; não assumidos como resultado do indicador.`)],
    };
    item.risks = risks.filter((risk) => risk.itemCodigo === item.code).map((risk, i) => {
      const action = item.actions.find((a) => a.code === risk.acaoCodigo);
      if (!action) throw new Error(`Risco órfão: ${item.code}/${risk.acaoCodigo}`);
      const stage = action.tasks.find((stage) => normalize(stage.title) === normalize(risk.etapa));
      if (risk.etapa && !stage) warnings.push(`${item.code}: escopo '${risk.etapa}' não encontrado; risco mantido na ação ${action.code}.`);
      return { id: id('risk', `${item.code}:${i}`), actionId: action.id, stage: stage?.title || '', title: risk.titulo,
        probability: risk.probabilidade, impact: risk.impacto, owner: risk.treatmentOwner, strategicRisk: risk.riscoEstrategico,
        cause: risk.causa, consequence: risk.consequencia, category: risk.categoria, controls: risk.controles, controlType: risk.tipoControle,
        maturity: risk.maturidade, response: risk.resposta, treatment: risk.tratamento, treatmentOwner: risk.treatmentOwner,
        deadline: risk.prazo, execution: risk.execucao, situation: risk.situacao, review: risk.review, status: risk.status };
    });
    plan.items.push(item);
  }
}

// A estrutura é documental. Execução, prazos e validações abaixo são simulações
// identificadas para testar filas, filtros, resultados, atrasos e gráficos futuros.
const scenarios = ['completed', 'active', 'overdue', 'submitted', 'correction', 'planned'] as const;
const simulated: object[] = [];
for (const axis of plan.axes) {
  const items = plan.items.filter((item) => item.axisId === axis.id);
  if (!items.length) throw new Error(`Eixo ${axis.code} vazio.`);
  items.forEach((item, index) => {
    // O NITT tem somente duas iniciativas na fonte: ambas continuam presentes.
    const scenario = scenarios[index % scenarios.length] || 'planned';
    const allTasks = item.actions.flatMap((action) => action.tasks);
    item.reviewStatus = scenario === 'completed' ? 'validated' : scenario === 'submitted' ? 'submitted' : scenario === 'correction' ? 'changes_requested' : 'draft';
    item.reviewNote = scenario === 'correction' ? `${tag}: complementar o acompanhamento e justificar a revisão do cronograma.` : '';
    item.actions.forEach((action) => {
      action.deadline = scenario === 'completed' ? '2026-09-30' : scenario === 'overdue' ? '2026-09-15' : scenario === 'planned' ? '2027-03-31' : '2026-12-15';
      action.tasks.forEach((stage) => {
        const taskIndex = allTasks.indexOf(stage);
        stage.status = scenario === 'completed' ? 'completed' : scenario === 'planned' ? 'not_started'
          : taskIndex < Math.floor(allTasks.length * (scenario === 'submitted' ? 0.8 : 0.4)) ? 'completed'
            : taskIndex < Math.ceil(allTasks.length * 0.8) ? 'in_progress' : 'not_started';
        stage.deadline = action.deadline;
        stage.justification = [stage.justification, `${tag}: situação e prazo simulados (${scenario}).`].filter(Boolean).join('\n');
      });
    });
    if (item.metric.measurementMode === 'manual' && !['planned', 'overdue'].includes(scenario)) {
      const target = item.metric.targets['2026'];
      if (typeof target === 'number') {
        const value = scenario === 'completed' ? target : target * (scenario === 'submitted' ? 0.95 : 0.65);
        for (const [month, factor] of [[6, 0.4], [8, 0.75], [10, 1]] as const) {
          item.measurements.push({ id: id('measurement', `${item.code}:2026:${month}`), year: 2026,
            value: item.metric.valueType === 'number' ? Math.round(value * factor) : Number((value * factor).toFixed(2)),
            note: `${tag}: resultado fictício para testar o acompanhamento de 2026.`, at: `2026-${String(month).padStart(2, '0')}-05T12:00:00-03:00`, evidence: '' });
        }
      }
    }
    item.risks.forEach((risk, i) => {
      // Probabilidade, impacto, controles e tratamento continuam os da fonte.
      risk.execution = scenario === 'completed' ? 100 : scenario === 'planned' ? 0 : ([0, 25, 50, 75][i % 4] ?? 0);
      risk.situation = scenario === 'completed' ? 'Concluído' : scenario === 'planned' ? 'Não iniciado' : scenario === 'overdue' ? 'Atrasado' : 'Em andamento';
      risk.status = 'Ativo';
    });
    item.source += ` · ${tag}: execução e validação simuladas`;
    item.extras.localScenario = scenario;
    item.history.push(history(`simulation:${item.code}`, `${tag}: etapas, prazos, resultados e tratamento dos riscos simulados (${scenario}); não representam execução oficial.`));
    simulated.push({ code: item.code, scenario, execution: executionStatus(item), review: item.reviewStatus });
  });
}
plan.items.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
plan.objectives.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
workspaceSchema.parse(workspace);
if (!validateWorkspace(workspace)) throw new Error('Estrutura inválida para o frontend.');
// IDs únicos inclusive entre ações/etapas/riscos; todos os riscos resolvem seu escopo.
const ids = plan.items.flatMap((item) => [item.id, ...item.actions.flatMap((a) => [a.id, ...a.tasks.map((s) => s.id)]), ...item.risks.map((r) => r.id)]);
if (new Set(ids).size !== ids.length) throw new Error('IDs duplicados.');
const revision = createHash('sha256').update(JSON.stringify({ sources, simulated, version: 2 })).digest('hex').slice(0, 20);
const counts = { axes: plan.axes.length, objectives: plan.objectives.length, items: plan.items.length, actions: plan.items.flatMap((i) => i.actions).length, stages: plan.items.flatMap((i) => i.actions.flatMap((a) => a.tasks)).length, risks: plan.items.flatMap((i) => i.risks).length, completed: plan.items.filter((i) => executionStatus(i) === 'Concluída').length };
const preview = { revision, at, counts, label: 'Estrutura das planilhas locais; execução simulada para testes.' };
workspace.localPreview = preview;
plan.localPreview = preview;
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'workspace.json'), JSON.stringify(workspace, null, 2));
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ ...preview, sources, simulated, warnings }, null, 2));
console.log(JSON.stringify({ ...counts, revision, warnings, output }, null, 2));
