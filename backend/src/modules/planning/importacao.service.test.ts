import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, Plan, Workspace } from "./planning.types.js";
import type { SessaoUsuario } from "../auth/auth.types.js";

const salvarWorkspaceMock = vi.fn(async (..._args: unknown[]) => {});
const montarWorkspaceMock = vi.fn(async (..._args: unknown[]): Promise<Workspace> => {
  throw new Error("montarWorkspaceMock não configurado para este teste");
});

vi.mock("./planning.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./planning.service.js")>();
  return {
    ...actual,
    salvarWorkspace: (...args: Parameters<typeof actual.salvarWorkspace>) => salvarWorkspaceMock(...args),
    montarWorkspace: (...args: Parameters<typeof actual.montarWorkspace>) => montarWorkspaceMock(...args),
  };
});

const { descreverAtualizacao, exportarPlanoXlsx, importarPlanilha } = await import("./importacao.service.js");

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

function planoBase(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "p1",
    type: "PDI",
    shortName: "PDI",
    name: "Plano de Desenvolvimento Institucional",
    start: 2026,
    end: 2027,
    status: "published",
    template: { id: "t1", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
    axes: [{ id: "a1", code: "8", name: "Governança", color: "#2f78a5", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [], customGrants: [] }],
    objectives: [{ id: "o1", axisId: "a1", code: "8.1", title: "Aperfeiçoar governança", ods: [] }],
    items: [],
    ...overrides,
  };
}

describe("exportarPlanoXlsx", () => {
  it("gera as duas abas com uma linha por etapa e uma por risco", async () => {
    const plano = planoBase({ items: [itemBase({ actions: [{ id: "ac1", code: "8.1.1.1", title: "Ação", owner: "", deadline: "", tasks: [{ id: "e1", title: "Etapa 1", status: "completed", deadline: "", justification: "", partners: "" }, { id: "e2", title: "Etapa 2", status: "not_started", deadline: "", justification: "", partners: "" }] }], risks: [{ id: "r1", actionId: "ac1", stage: "Etapa 1", title: "Risco de teste", probability: 3, impact: 3, owner: "", strategicRisk: "", cause: "", consequence: "", category: "", controls: "", controlType: "", maturity: "", response: "", treatment: "", treatmentOwner: "", deadline: "", execution: 0, situation: "", review: "", status: "" }] })] });

    const buffer = await exportarPlanoXlsx(plano);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const abaPdi = workbook.getWorksheet("MONITORAMENTO PDI");
    expect(abaPdi?.rowCount).toBe(3); // cabeçalho + 2 etapas
    expect(abaPdi?.getRow(1).getCell(1).value).toBe("Eixo");
    expect(abaPdi?.getRow(2).getCell(1).value).toBe("8"); // primeira linha do item leva o código do eixo
    expect(abaPdi?.getRow(3).getCell(1).value).toBe(""); // linhas seguintes do mesmo item não repetem

    const abaRiscos = workbook.getWorksheet("GERENCIAMENTO DE RISCOS");
    expect(abaRiscos?.rowCount).toBe(2); // cabeçalho + 1 risco
    expect(abaRiscos?.getRow(2).getCell(10).value).toBe("Risco de teste");
  });

  it("gera uma linha mesmo para item sem ações", async () => {
    const plano = planoBase({ items: [itemBase({ actions: [] })] });
    const buffer = await exportarPlanoXlsx(plano);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("MONITORAMENTO PDI")?.rowCount).toBe(2);
  });

  it("inclui uma coluna de Meta e Execução por ano da vigência do plano", async () => {
    const plano = planoBase({ start: 2026, end: 2028, items: [] });
    const buffer = await exportarPlanoXlsx(plano);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const cabecalhos = workbook.getWorksheet("MONITORAMENTO PDI")!.getRow(1).values as string[];
    expect(cabecalhos).toContain("Meta 2026");
    expect(cabecalhos).toContain("Meta 2028");
    expect(cabecalhos).toContain("Execução 2027");
  });
});

describe("importarPlanilha — autorização por eixo", () => {
  beforeEach(() => {
    salvarWorkspaceMock.mockClear();
    montarWorkspaceMock.mockReset();
  });

  function sessaoComGrants(grants: SessaoUsuario["grants"]): SessaoUsuario {
    return { authenticated: true, user: { id: "u1", name: "Teste", email: null }, roles: [], grants };
  }

  async function arquivoDoEixo(plano: Plan) {
    const buffer = await exportarPlanoXlsx(plano);
    return { originalname: "planilha.xlsx", mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buffer.length, buffer };
  }

  it("rejeita quem não tem item.edit no eixo identificado na planilha", async () => {
    const plano = planoBase({ items: [itemBase({ actions: [{ id: "ac1", code: "8.1.1.1", title: "Ação", owner: "", deadline: "", tasks: [] }] })] });
    montarWorkspaceMock.mockResolvedValueOnce({ version: 2, templates: [plano.template], plans: [plano] });

    const sessaoSemPermissao = sessaoComGrants([
      { permission: "plan.read_internal", scope: { type: "axis", planId: "p1", axisId: "a1" } },
    ]);

    await expect(importarPlanilha(sessaoSemPermissao, "p1", await arquivoDoEixo(plano))).rejects.toMatchObject({
      status: 403,
    });
    expect(salvarWorkspaceMock).not.toHaveBeenCalled();
  });

  it("permite quem tem item.edit escopado ao eixo da planilha (Gestor do Eixo)", async () => {
    const plano = planoBase({ items: [itemBase({ actions: [{ id: "ac1", code: "8.1.1.1", title: "Ação", owner: "", deadline: "", tasks: [] }] })] });
    montarWorkspaceMock.mockResolvedValueOnce({ version: 2, templates: [plano.template], plans: [plano] });

    const sessaoGestor = sessaoComGrants([
      { permission: "item.edit", scope: { type: "axis", planId: "p1", axisId: "a1" } },
    ]);

    const resumo = await importarPlanilha(sessaoGestor, "p1", await arquivoDoEixo(plano));
    expect(resumo.eixo).toContain("8");
    expect(salvarWorkspaceMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita quem tem item.edit em outro eixo (não no eixo da planilha)", async () => {
    const plano = planoBase({ items: [itemBase({ actions: [{ id: "ac1", code: "8.1.1.1", title: "Ação", owner: "", deadline: "", tasks: [] }] })] });
    montarWorkspaceMock.mockResolvedValueOnce({ version: 2, templates: [plano.template], plans: [plano] });

    const sessaoOutroEixo = sessaoComGrants([
      { permission: "item.edit", scope: { type: "axis", planId: "p1", axisId: "outro-eixo" } },
    ]);

    await expect(importarPlanilha(sessaoOutroEixo, "p1", await arquivoDoEixo(plano))).rejects.toMatchObject({
      status: 403,
    });
    expect(salvarWorkspaceMock).not.toHaveBeenCalled();
  });
});
