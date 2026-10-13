import { describe, expect, it } from "vitest";
import { coberturaExecucao, periodoAtual } from "./eixoVersoes.service.js";
import type { ActionItem, Item, Stage } from "./planning.types.js";

function stage(status: Stage["status"]): Stage {
  return { id: `s-${Math.random()}`, title: "Etapa", status, deadline: "", justification: "", partners: "" };
}

function itemComEtapas(...status: Array<Stage["status"]>): Item {
  const acao: ActionItem = { id: "a1", code: "1.1", title: "Ação", owner: "", deadline: "", tasks: status.map(stage) };
  return {
    id: "i1",
    code: "1.1.1",
    axisId: "eixo-1",
    objectiveId: "o1",
    title: "Iniciativa",
    owner: "",
    partners: "",
    description: "",
    source: "",
    reviewStatus: "draft",
    reviewNote: "",
    metric: {
      name: "",
      measurementMode: "manual",
      valueType: "number",
      unit: "",
      periodicity: "annual",
      baseline: null,
      reference: "",
      direction: "up",
      targets: {},
      formula: "",
    },
    measurements: [],
    extras: {},
    actions: [acao],
    history: [],
    risks: [],
  };
}

describe("coberturaExecucao", () => {
  it("retorna 0 quando o eixo não tem etapas", () => {
    expect(coberturaExecucao([])).toBe(0);
  });

  it("calcula a proporção de etapas concluídas entre as etapas ativas", () => {
    const item = itemComEtapas("completed", "completed", "in_progress", "not_started");
    expect(coberturaExecucao([item])).toBe(50);
  });

  it("ignora etapas canceladas no cálculo", () => {
    const item = itemComEtapas("completed", "cancelled", "cancelled");
    expect(coberturaExecucao([item])).toBe(100);
  });

  it("soma etapas de vários itens do eixo", () => {
    const itemA = itemComEtapas("completed", "not_started");
    const itemB = itemComEtapas("completed", "completed");
    expect(coberturaExecucao([itemA, itemB])).toBe(75);
  });
});

describe("periodoAtual", () => {
  it("usa o ano corrente quando está dentro da vigência do plano", () => {
    const anoAtual = new Date().getFullYear();
    expect(periodoAtual({ start: anoAtual - 1, end: anoAtual + 1 })).toBe(anoAtual);
  });

  it("limita ao início da vigência quando o ano corrente é anterior", () => {
    const anoAtual = new Date().getFullYear();
    expect(periodoAtual({ start: anoAtual + 1, end: anoAtual + 5 })).toBe(anoAtual + 1);
  });

  it("limita ao fim da vigência quando o ano corrente é posterior", () => {
    const anoAtual = new Date().getFullYear();
    expect(periodoAtual({ start: anoAtual - 5, end: anoAtual - 1 })).toBe(anoAtual - 1);
  });
});
