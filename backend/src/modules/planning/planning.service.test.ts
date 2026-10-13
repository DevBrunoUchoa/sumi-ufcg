import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoUsuario } from "../auth/auth.types.js";
import type { Workspace } from "./planning.types.js";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizar: vi.fn() }));
vi.mock("./planning.repository.js", () => ({
  tipoPlanoRepo: { listar: mocks.listar, atualizarMetadados: mocks.atualizar },
  noPlanoRepo: { listarTodos: vi.fn().mockResolvedValue([]), upsertLote: vi.fn().mockResolvedValue(undefined), removerLote: vi.fn().mockResolvedValue(undefined), criarRaiz: vi.fn().mockResolvedValue(undefined) },
  ...Object.fromEntries(["indicadorRepo", "resultadoRepo", "acaoRepo", "etapaRepo", "riscoRepo", "historicoRepo", "anexoRepo"].map((name) => [name, { listarTodos: vi.fn().mockResolvedValue([]) }])),
}));
import { salvarWorkspace } from "./planning.service.js";
import { noPlanoRepo } from "./planning.repository.js";

const session: SessaoUsuario = {
  authenticated: true,
  user: { id: "user", name: "Gestor", email: "gestor@example.test" }, roles: [],
  grants: [{ permission: "plan.read_published", scope: { type: "global" } }],
};
const workspace = (): Workspace => ({ version: 2, plans: [], templates: [{
  id: "pdi", type: "PDI", name: "PDI", version: 1, description: "",
  labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" },
  defaultPeriodicity: "annual", fields: [],
}] });

describe("salvarWorkspace com metadados JSONB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([{ id: "pdi", versao: 1, rotulos: { item: "Iniciativa", axis: "Eixo", objective: "Objetivo" }, campos_extras: [] }]);
  });
  it("não exige permissão de modelo quando só a ordem das chaves mudou", async () => {
    await expect(salvarWorkspace(session, workspace())).resolves.toBeUndefined();
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("continua negando uma alteração real do modelo sem a permissão", async () => {
    const changed = workspace(); changed.templates[0]!.labels.objective = "Diretriz";
    await expect(salvarWorkspace(session, changed)).rejects.toMatchObject({ status: 403 });
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("preserva a exclusão de campos undefined usada nas comparações de autorização", async () => {
    mocks.listar.mockResolvedValue([{ id: "pdi", versao: 1, rotulos: { ...workspace().templates[0]!.labels, excluded: undefined }, campos_extras: [] }]);
    await expect(salvarWorkspace(session, workspace())).resolves.toBeUndefined();
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
  it("persiste alteração real para quem tem permissão de administrar modelos", async () => {
    const changed = workspace(); changed.templates[0]!.labels.objective = "Diretriz";
    const admin = { ...session, grants: [...session.grants, { permission: "model.manage" as const, scope: { type: "global" as const } }] };
    await salvarWorkspace(admin, changed);
    expect(mocks.atualizar).toHaveBeenCalledWith("pdi", { rotulos: changed.templates[0]!.labels, camposExtras: [], versao: 1 });
  });
});

describe("salvarWorkspace — criação de objetivo durante a importação (Gestor do Eixo)", () => {
  const planoId = "p1";
  const axisId = "a1";
  const now = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([{ id: "pdi", versao: 1, rotulos: { item: "Iniciativa", axis: "Eixo", objective: "Objetivo" }, campos_extras: [] }]);
    (noPlanoRepo.listarTodos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: planoId, tipo_plano_id: "pdi", no_pai_id: null, nivel: -1, ordem: 0, dados: { shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published" }, criado_em: now, atualizado_em: now },
      { id: axisId, tipo_plano_id: "pdi", no_pai_id: planoId, nivel: 0, ordem: 0, dados: { code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [], customGrants: [] }, criado_em: now, atualizado_em: now },
    ]);
  });

  function workspaceComNovoObjetivo(): Workspace {
    return {
      version: 2,
      templates: [{ id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] }],
      plans: [{
        id: planoId, type: "PDI", shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published",
        template: { id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
        axes: [{ id: axisId, code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [], customGrants: [] }],
        objectives: [{ id: "o-novo", axisId, code: "8.9", title: "Objetivo novo trazido pela planilha" }],
        items: [],
      }],
    };
  }

  it("permite criar objetivo no eixo para quem só tem item.edit nesse eixo (sem plan.manage)", async () => {
    const gestor: SessaoUsuario = { ...session, grants: [...session.grants, { permission: "item.edit", scope: { type: "axis", planId: planoId, axisId } }] };
    await expect(salvarWorkspace(gestor, workspaceComNovoObjetivo())).resolves.toBeUndefined();
  });

  it("continua negando a criação de objetivo para quem não tem nenhuma permissão nesse eixo", async () => {
    await expect(salvarWorkspace(session, workspaceComNovoObjetivo())).rejects.toMatchObject({ status: 403 });
  });

  it("nega quando item.edit é de outro eixo", async () => {
    const outroEixo: SessaoUsuario = { ...session, grants: [...session.grants, { permission: "item.edit", scope: { type: "axis", planId: planoId, axisId: "outro-eixo" } }] };
    await expect(salvarWorkspace(outroEixo, workspaceComNovoObjetivo())).rejects.toMatchObject({ status: 403 });
  });
});

describe("salvarWorkspace — eixo sem customGrants gravado (dado antigo)", () => {
  const planoId = "p1";
  const axisId = "a1";
  const now = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([{ id: "pdi", versao: 1, rotulos: { item: "Iniciativa", axis: "Eixo", objective: "Objetivo" }, campos_extras: [] }]);
    // Reproduz uma linha de eixo gravada antes de customGrants existir
    // (PR #17): a chave simplesmente não está em `dados`, como no banco real.
    (noPlanoRepo.listarTodos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: planoId, tipo_plano_id: "pdi", no_pai_id: null, nivel: -1, ordem: 0, dados: { shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published" }, criado_em: now, atualizado_em: now },
      { id: axisId, tipo_plano_id: "pdi", no_pai_id: planoId, nivel: 0, ordem: 0, dados: { code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [] }, criado_em: now, atualizado_em: now },
    ]);
  });

  it("não trata customGrants ausente no banco como diferente de [] no workspace (eixo não deveria 'mudar')", async () => {
    const gestor: SessaoUsuario = { ...session, grants: [...session.grants, { permission: "item.edit", scope: { type: "axis", planId: planoId, axisId } }] };
    const ws: Workspace = {
      version: 2,
      templates: [{ id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] }],
      plans: [{
        id: planoId, type: "PDI", shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published",
        template: { id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
        // Mesmo eixo, nenhuma mudança de estrutura — só customGrants chega
        // como [] (como montarWorkspace sempre entrega), diferente da linha
        // no banco, que nunca teve essa chave gravada.
        axes: [{ id: axisId, code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [], customGrants: [] }],
        objectives: [],
        items: [],
      }],
    };
    await expect(salvarWorkspace(gestor, ws)).resolves.toBeUndefined();
    expect(noPlanoRepo.upsertLote).not.toHaveBeenCalled();
  });
});
