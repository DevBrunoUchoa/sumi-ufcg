import { describe, expect, it } from "vitest";
import { workspaceSchema } from "./planning.schema.js";
import type { Risk } from "./planning.types.js";

function workspaceValido() {
  return {
    version: 2,
    templates: [
      { id: "t1", type: "PDI", name: "Desenvolvimento institucional", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
    ],
    plans: [
      {
        id: "p1",
        type: "PDI",
        shortName: "PDI",
        name: "Plano de Desenvolvimento Institucional",
        start: 2026,
        end: 2030,
        status: "published",
        template: { id: "t1", type: "PDI", name: "Desenvolvimento institucional", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
        axes: [{ id: "a1", code: "8", name: "Governança", color: "#2f78a5", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [] }],
        objectives: [{ id: "o1", axisId: "a1", code: "8.1", title: "Objetivo" }],
        items: [
          {
            id: "i1",
            code: "8.1.1",
            axisId: "a1",
            objectiveId: "o1",
            title: "Item",
            owner: "SEPLAN",
            partners: "",
            description: "",
            source: "",
            reviewStatus: "draft",
            reviewNote: "",
            metric: { name: "Indicador", measurementMode: "manual", valueType: "number", unit: "un", periodicity: "annual", baseline: 0, reference: "", direction: "up", targets: { 2026: 10 }, formula: "" },
            measurements: [],
            extras: {},
            actions: [],
            history: [],
            risks: [] as Risk[],
          },
        ],
      },
    ],
  };
}

describe("workspaceSchema", () => {
  it("aceita um workspace bem formado", () => {
    const resultado = workspaceSchema.safeParse(workspaceValido());
    expect(resultado.success).toBe(true);
  });

  it("rejeita item com axisId inexistente", () => {
    const workspace = workspaceValido();
    workspace.plans[0]!.items[0]!.axisId = "eixo-fantasma";
    const resultado = workspaceSchema.safeParse(workspace);
    expect(resultado.success).toBe(false);
  });

  it("rejeita risco com actionId inexistente", () => {
    const workspace = workspaceValido();
    workspace.plans[0]!.items[0]!.risks.push({
      id: "r1",
      actionId: "acao-fantasma",
      stage: "",
      title: "Risco",
      probability: 3,
      impact: 3,
      owner: "SEPLAN",
      strategicRisk: "",
      cause: "",
      consequence: "",
      category: "",
      controls: "",
      controlType: "",
      maturity: "",
      response: "",
      treatment: "",
      treatmentOwner: "",
      deadline: "",
      execution: 0,
      situation: "",
      review: "",
      status: "",
    });
    const resultado = workspaceSchema.safeParse(workspace);
    expect(resultado.success).toBe(false);
  });

  it("rejeita vigência de plano maior que 11 anos", () => {
    const workspace = workspaceValido();
    workspace.plans[0]!.end = 2040;
    const resultado = workspaceSchema.safeParse(workspace);
    expect(resultado.success).toBe(false);
  });

  it("rejeita plano referenciando template inexistente", () => {
    const workspace = workspaceValido();
    workspace.plans[0]!.template.id = "template-fantasma";
    const resultado = workspaceSchema.safeParse(workspace);
    expect(resultado.success).toBe(false);
  });
});
