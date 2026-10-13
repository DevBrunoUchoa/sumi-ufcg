import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoUsuario } from "../auth/auth.types.js";
import type { Workspace } from "./planning.types.js";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizar: vi.fn() }));
vi.mock("./planning.repository.js", () => ({
  tipoPlanoRepo: { listar: mocks.listar, atualizarMetadados: mocks.atualizar },
  noPlanoRepo: { listarTodos: vi.fn().mockResolvedValue([]) },
  ...Object.fromEntries(["indicadorRepo", "resultadoRepo", "acaoRepo", "etapaRepo", "riscoRepo", "historicoRepo", "anexoRepo"].map((name) => [name, { listarTodos: vi.fn().mockResolvedValue([]) }])),
}));
import { salvarWorkspace } from "./planning.service.js";

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
