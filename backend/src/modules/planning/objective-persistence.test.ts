import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoUsuario } from "../auth/auth.types.js";
import type { Plan, Workspace } from "./planning.types.js";

const mocks = vi.hoisted(() => ({ list: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock("./planning.repository.js", () => ({
  tipoPlanoRepo: { listar: vi.fn().mockResolvedValue([]) },
  noPlanoRepo: { listarTodos: mocks.list, upsertLote: mocks.upsert, removerLote: mocks.remove },
  ...Object.fromEntries(["indicadorRepo", "resultadoRepo", "acaoRepo", "etapaRepo", "riscoRepo", "historicoRepo", "anexoRepo"].map(name => [name, { listarTodos: vi.fn().mockResolvedValue([]) }])),
}));
import { salvarWorkspace } from "./planning.service.js";

const session: SessaoUsuario = { authenticated: true, user: { id: "u1", name: "Gestor", email: "test@example.test" }, roles: [], grants: [{ permission: "stage.update", scope: { type: "global" } }] };
const admin: SessaoUsuario = { ...session, grants: [...session.grants, { permission: "plan.manage", scope: { type: "global" } }] };
const plan = (): Plan => ({
  id: "p1", type: "PDI", shortName: "PDI", name: "Plano", start: 2026, end: 2030, status: "published",
  template: { id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
  axes: [{ id: "a1", code: "1", name: "Ensino", color: "#123456", ownerUnit: "PRE", managerIds: [], reviewerIds: [], customGrants: [] }],
  objectives: [{ id: "o1", axisId: "a1", code: "1.1", title: "Objetivo" }], items: [],
});
const workspace = (): Workspace => ({ version: 2, templates: [], plans: [plan()] });
function stored(ods?: number[]) {
  const p = plan(); const { id: axisId, ...axisData } = p.axes[0]!;
  return [
    { id: p.id, nivel: -1, no_pai_id: null, tipo_plano_id: "pdi", ordem: 0, dados: { shortName: p.shortName, name: p.name, start: p.start, end: p.end, status: p.status } },
    { id: axisId, nivel: 0, no_pai_id: p.id, tipo_plano_id: "pdi", ordem: 0, dados: axisData },
    { id: "o1", nivel: 1, no_pai_id: axisId, tipo_plano_id: "pdi", ordem: 0, dados: { code: "1.1", title: "Objetivo", ...(ods === undefined ? {} : { ods }) } },
  ];
}

describe("salvamento de ODS e autorização de estrutura", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue(stored()); });
  it("gestor salva objetivo legado sem alteração de estrutura", async () => {
    await expect(salvarWorkspace(session, workspace())).resolves.toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("cliente antigo não apaga ODS já cadastradas", async () => {
    mocks.list.mockResolvedValue(stored([4, 16]));
    await expect(salvarWorkspace(session, workspace())).resolves.toBeUndefined();
    const changed = workspace(); changed.plans[0]!.objectives[0]!.title = "Título atualizado";
    await salvarWorkspace(admin, changed);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ dados: { code: "1.1", title: "Título atualizado", ods: [4, 16] } })]);
  });
  it("somente administração de estrutura pode alterar ou remover ODS", async () => {
    mocks.list.mockResolvedValue(stored([4, 16]));
    const changed = workspace(); changed.plans[0]!.objectives[0]!.ods = [];
    await expect(salvarWorkspace(session, changed)).rejects.toMatchObject({ status: 403 });
    expect(mocks.upsert).not.toHaveBeenCalled();
    await salvarWorkspace(admin, changed);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({ dados: { code: "1.1", title: "Objetivo", ods: [] } })]);
  });
  it("normalização de duplicatas não exige permissão de estrutura", async () => {
    mocks.list.mockResolvedValue(stored([16, 4, 4]));
    const unchanged = workspace(); unchanged.plans[0]!.objectives[0]!.ods = [4, 16];
    await expect(salvarWorkspace(session, unchanged)).resolves.toBeUndefined();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
