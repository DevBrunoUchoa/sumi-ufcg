import { describe, expect, it } from "vitest";
import { descreverAtualizacao } from "./importacao.service.js";
import type { Item } from "./planning.types.js";

function itemBase(overrides: Partial<Item> = {}): Item {
  return {
    id: "i1",
    code: "8.1.1",
    axisId: "a1",
    objectiveId: "o1",
    title: "Iniciativa original",
    owner: "SEPLAN",
    partners: "",
    description: "",
    source: "",
    reviewStatus: "draft",
    reviewNote: "",
    metric: {
      name: "Indicador original",
      measurementMode: "manual",
      valueType: "number",
      unit: "",
      periodicity: "annual",
      baseline: 10,
      reference: "",
      direction: "up",
      targets: { "2026": 20, "2027": 30 },
      formula: "",
    },
    measurements: [],
    extras: {},
    actions: [],
    history: [],
    risks: [],
    ...overrides,
  };
}

describe("descreverAtualizacao", () => {
  it("não relata mudança quando o item reimportado é idêntico", () => {
    const item = itemBase();
    expect(descreverAtualizacao(item, itemBase())).toEqual([]);
  });

  it("relata mudança de título", () => {
    const mudancas = descreverAtualizacao(itemBase(), itemBase({ title: "Novo título" }));
    expect(mudancas).toContain('título alterado para "Novo título"');
  });

  it("relata mudança de indicador e linha de base", () => {
    const depois = itemBase({ metric: { ...itemBase().metric, name: "Novo indicador", baseline: 15 } });
    const mudancas = descreverAtualizacao(itemBase(), depois);
    expect(mudancas).toContain('indicador alterado para "Novo indicador"');
    expect(mudancas).toContain("linha de base alterada para 15");
  });

  it("relata só os anos de meta que mudaram", () => {
    const depois = itemBase({ metric: { ...itemBase().metric, targets: { "2026": 20, "2027": 99 } } });
    const mudancas = descreverAtualizacao(itemBase(), depois);
    expect(mudancas).toContain("meta de 2027 atualizada");
    expect(mudancas.join(" ")).not.toContain("2026 atualizada");
  });

  it("relata execução nova registrada", () => {
    const depois = itemBase({ measurements: [{ id: "m1", year: 2026, value: 5, note: "", at: "2026-01-01", evidence: "" }] });
    const mudancas = descreverAtualizacao(itemBase(), depois);
    expect(mudancas).toContain("execução de 2026 registrada");
  });

  it("relata ações novas e removidas, e a variação de etapas", () => {
    const acao = (code: string, etapas: number) => ({
      id: code,
      code,
      title: "Ação",
      owner: "",
      deadline: "",
      tasks: Array.from({ length: etapas }, (_, i) => ({ id: `${code}-${i}`, title: "Etapa", status: "not_started" as const, deadline: "", justification: "", partners: "" })),
    });
    const antes = itemBase({ actions: [acao("8.1.1.1", 2)] });
    const depois = itemBase({ actions: [acao("8.1.1.1", 3), acao("8.1.1.2", 1)] });
    const mudancas = descreverAtualizacao(antes, depois);
    expect(mudancas).toContain("1 ação nova");
    expect(mudancas).toContain("etapas: 2 → 4");
  });

  it("relata variação na contagem de riscos", () => {
    const risco = (id: string) => ({
      id, actionId: "a1", stage: "", title: "Risco", probability: 1, impact: 1, owner: "", strategicRisk: "",
      cause: "", consequence: "", category: "", controls: "", controlType: "", maturity: "", response: "",
      treatment: "", treatmentOwner: "", deadline: "", execution: 0, situation: "", review: "", status: "",
    });
    const depois = itemBase({ risks: [risco("r1"), risco("r2")] });
    const mudancas = descreverAtualizacao(itemBase(), depois);
    expect(mudancas).toContain("riscos: 0 → 2");
  });
});
