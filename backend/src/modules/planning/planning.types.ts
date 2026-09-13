// Espelha o modelo consumido pelo frontend aprovado (sumi-prototipo/src/domain.js,
// WORKSPACE_VERSION 2). Ver docs/adr/0005-integracao-workspace-real.md.

export type ModoMedicao = "manual" | "delivery" | "stages";
export type TipoValor = "number" | "percentage" | "status";
export type Periodicidade = "annual" | "final";
export type Direcao = "up" | "down";
export type SituacaoEtapa = "not_started" | "in_progress" | "completed" | "cancelled";
export type SituacaoValidacao = "draft" | "submitted" | "validated" | "changes_requested";

export interface CampoExtraDef {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options: string;
}

export interface Template {
  id: string;
  type: string;
  name: string;
  version: number;
  description: string;
  labels: { axis: string; objective: string; item: string };
  defaultPeriodicity: Periodicidade;
  fields: CampoExtraDef[];
}

export interface Axis {
  id: string;
  code: string;
  name: string;
  color: string;
  ownerUnit: string;
  managerIds: string[];
  reviewerIds: string[];
}

export interface Objective {
  id: string;
  axisId: string;
  code: string;
  title: string;
}

export interface Metric {
  name: string;
  measurementMode: ModoMedicao;
  valueType: TipoValor;
  unit: string;
  periodicity: Periodicidade;
  baseline: number | string | null;
  reference: string;
  direction: Direcao;
  targets: Record<string, number | string | null>;
  formula: string;
  completedValue?: string;
}

export interface Measurement {
  id: string;
  year: number;
  value: number | string | null;
  note: string;
  at: string;
  evidence: string;
}

export interface Stage {
  id: string;
  title: string;
  status: SituacaoEtapa;
  deadline: string;
  justification: string;
  partners: string;
}

export interface ActionItem {
  id: string;
  code: string;
  title: string;
  owner: string;
  deadline: string;
  tasks: Stage[];
}

export interface Risk {
  id: string;
  actionId: string;
  stage: string;
  title: string;
  probability: number;
  impact: number;
  owner: string;
  strategicRisk: string;
  cause: string;
  consequence: string;
  category: string;
  controls: string;
  controlType: string;
  maturity: string;
  response: string;
  treatment: string;
  treatmentOwner: string;
  deadline: string;
  execution: number;
  situation: string;
  review: string;
  status: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  text: string;
  actor: string;
}

export interface Item {
  id: string;
  code: string;
  axisId: string;
  objectiveId: string;
  title: string;
  owner: string;
  partners: string;
  description: string;
  source: string;
  reviewStatus: SituacaoValidacao;
  reviewNote: string;
  linkedPlan?: string;
  metric: Metric;
  measurements: Measurement[];
  extras: Record<string, string>;
  actions: ActionItem[];
  history: HistoryEntry[];
  risks: Risk[];
}

export interface Plan {
  id: string;
  type: string;
  shortName: string;
  name: string;
  start: number;
  end: number;
  status: "draft" | "published";
  template: Template;
  axes: Axis[];
  objectives: Objective[];
  items: Item[];
}

export interface Workspace {
  version: 2;
  templates: Template[];
  plans: Plan[];
}
