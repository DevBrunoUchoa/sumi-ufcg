import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";

// Espelha as validações de src/domain.js (validateWorkspace e afins) no
// frontend aprovado, mais checagens referenciais (axisId/objectiveId/
// templateId existentes) que o frontend não precisa fazer porque só
// referencia o que ele mesmo tem em memória, mas que o backend precisa
// garantir antes de gravar.

const presente = z.string().trim().min(1);
const valorMetrica = z.union([z.number(), z.string(), z.null()]);

export const campoExtraDefSchema = z.object({
  id: presente,
  label: presente,
  type: z.enum(["text", "number", "date", "select"]),
  options: z.string(),
});

export const templateSchema = z.object({
  id: presente,
  type: presente,
  name: presente,
  version: z.number().int().min(1),
  description: z.string(),
  labels: z.object({ axis: presente, objective: presente, item: presente }),
  defaultPeriodicity: z.enum(["annual", "final"]),
  fields: z.array(campoExtraDefSchema),
});

const axisSchema = z.object({
  id: presente,
  code: presente,
  name: presente,
  color: presente,
  ownerUnit: z.string(),
  managerIds: z.array(z.string()),
  reviewerIds: z.array(z.string()),
});

const objectiveSchema = z.object({
  id: presente,
  axisId: presente,
  code: presente,
  title: presente,
});

const metricSchema = z.object({
  name: presente,
  measurementMode: z.enum(["manual", "delivery", "stages"]),
  valueType: z.enum(["number", "percentage", "status"]),
  unit: z.string(),
  periodicity: z.enum(["annual", "final"]),
  baseline: valorMetrica,
  reference: z.string(),
  direction: z.enum(["up", "down"]),
  targets: z.record(z.string(), valorMetrica),
  formula: z.string(),
  completedValue: z.string().optional(),
});

const measurementSchema = z.object({
  id: presente,
  year: z.number().int(),
  value: valorMetrica,
  note: z.string(),
  at: presente,
  evidence: z.string(),
});

const stageSchema = z.object({
  id: presente,
  title: presente,
  status: z.enum(["not_started", "in_progress", "completed", "cancelled"]),
  deadline: z.string(),
  justification: z.string(),
  partners: z.string(),
});

const actionSchema = z.object({
  id: presente,
  code: presente,
  title: presente,
  owner: z.string(),
  deadline: z.string(),
  tasks: z.array(stageSchema),
});

const riskSchema = z.object({
  id: presente,
  actionId: presente,
  stage: z.string(),
  title: presente,
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  owner: z.string(),
  strategicRisk: z.string(),
  cause: z.string(),
  consequence: z.string(),
  category: z.string(),
  controls: z.string(),
  controlType: z.string(),
  maturity: z.string(),
  response: z.string(),
  treatment: z.string(),
  treatmentOwner: z.string(),
  deadline: z.string(),
  execution: z.number(),
  situation: z.string(),
  review: z.string(),
  status: z.string(),
});

const historyEntrySchema = z.object({
  id: presente,
  at: presente,
  text: presente,
  actor: z.string(),
});

const itemSchema = z.object({
  id: presente,
  code: presente,
  axisId: presente,
  objectiveId: presente,
  title: presente,
  owner: z.string(),
  partners: z.string(),
  description: z.string(),
  source: z.string(),
  reviewStatus: z.enum(["draft", "submitted", "validated", "changes_requested"]),
  reviewNote: z.string(),
  linkedPlan: z.string().optional(),
  metric: metricSchema,
  measurements: z.array(measurementSchema),
  extras: z.record(z.string(), z.string()),
  actions: z.array(actionSchema),
  history: z.array(historyEntrySchema),
  risks: z.array(riskSchema),
});

function validarIntervalo(start: number, end: number): boolean {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 2020 && end <= 2100 && end >= start && end - start <= 10;
}

const planSchema = z
  .object({
    id: presente,
    type: presente,
    shortName: presente,
    name: presente,
    start: z.number().int(),
    end: z.number().int(),
    status: z.enum(["draft", "published"]),
    template: templateSchema,
    axes: z.array(axisSchema),
    objectives: z.array(objectiveSchema),
    items: z.array(itemSchema),
  })
  .superRefine((plano, ctx) => {
    if (!validarIntervalo(plano.start, plano.end)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "vigência inválida (2020–2100, até 11 anos)", path: ["end"] });
    }
    const idsEixos = new Set(plano.axes.map((axis) => axis.id));
    const idsObjetivos = new Set(plano.objectives.map((objective) => objective.id));
    plano.objectives.forEach((objective, index) => {
      if (!idsEixos.has(objective.axisId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `axisId "${objective.axisId}" não existe`, path: ["objectives", index, "axisId"] });
      }
    });
    plano.items.forEach((item, index) => {
      if (!idsEixos.has(item.axisId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `axisId "${item.axisId}" não existe`, path: ["items", index, "axisId"] });
      }
      if (!idsObjetivos.has(item.objectiveId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `objectiveId "${item.objectiveId}" não existe`, path: ["items", index, "objectiveId"] });
      }
      const idsAcoes = new Set(item.actions.map((action) => action.id));
      item.risks.forEach((risk, riskIndex) => {
        if (!idsAcoes.has(risk.actionId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `actionId "${risk.actionId}" não existe no item "${item.id}"`,
            path: ["items", index, "risks", riskIndex, "actionId"],
          });
        }
      });
    });
  });

export const workspaceSchema = z
  .object({
    version: z.literal(2),
    templates: z.array(templateSchema),
    plans: z.array(planSchema),
  })
  .superRefine((workspace, ctx) => {
    const idsTemplates = new Set(workspace.templates.map((template) => template.id));
    workspace.plans.forEach((plan, index) => {
      if (!idsTemplates.has(plan.template.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `template "${plan.template.id}" não existe em templates`, path: ["plans", index, "template", "id"] });
      }
    });
  });

export function parseOrLancar<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw new HttpError(400, "Estrutura de planejamento inválida", resultado.error.flatten());
  }
  return resultado.data;
}
