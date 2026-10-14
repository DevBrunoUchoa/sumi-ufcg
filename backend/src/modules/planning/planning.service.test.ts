import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoUsuario } from "../auth/auth.types.js";
import type { SituacaoValidacao, Workspace } from "./planning.types.js";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizar: vi.fn() }));
vi.mock("./planning.repository.js", () => ({
  tipoPlanoRepo: { listar: mocks.listar, atualizarMetadados: mocks.atualizar },
  noPlanoRepo: { buscarPorId: vi.fn().mockResolvedValue(null), listarTodos: vi.fn().mockResolvedValue([]), upsertLote: vi.fn().mockResolvedValue(undefined), removerLote: vi.fn().mockResolvedValue(undefined), criarRaiz: vi.fn().mockResolvedValue(undefined) },
  ...Object.fromEntries(["indicadorRepo", "resultadoRepo", "acaoRepo", "etapaRepo", "riscoRepo", "historicoRepo"].map((name) => [name, {
    listarTodos: vi.fn().mockResolvedValue([]),
    upsertLote: vi.fn().mockResolvedValue(undefined),
    inserirLote: vi.fn().mockResolvedValue(undefined),
    removerPorItens: vi.fn().mockResolvedValue(undefined),
  }])),
  anexoRepo: { listarTodos: vi.fn().mockResolvedValue([]), listarPorItem: vi.fn().mockResolvedValue([]), recriarLote: vi.fn().mockResolvedValue(undefined) },
}));
const authMocks = vi.hoisted(() => ({ listarPorIds: vi.fn().mockResolvedValue([]) }));
vi.mock("../auth/auth.repository.js", () => ({ usuarioRepository: { listarPorIds: authMocks.listarPorIds } }));
const mailerMocks = vi.hoisted(() => ({ enviar: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../lib/mailer.js", () => ({ mailer: { enviar: mailerMocks.enviar } }));
import { removerPlano, salvarWorkspace } from "./planning.service.js";
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

describe("salvarWorkspace — itens de um workspace grande são gravados em paralelo", () => {
  const planoId = "p1";
  const axisId = "a1";
  const objectiveId = "o1";
  const now = new Date().toISOString();
  const admin: SessaoUsuario = {
    authenticated: true,
    user: { id: "admin", name: "Admin", email: "admin@example.test" }, roles: [],
    grants: [{ permission: "plan.manage", scope: { type: "global" } }, { permission: "item.edit", scope: { type: "global" } }, { permission: "action.manage", scope: { type: "global" } }, { permission: "indicator.edit_target", scope: { type: "global" } }, { permission: "result.create", scope: { type: "global" } }, { permission: "risk.manage", scope: { type: "global" } }, { permission: "history.comment", scope: { type: "global" } }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([{ id: "pdi", versao: 1, rotulos: { item: "Iniciativa", axis: "Eixo", objective: "Objetivo" }, campos_extras: [] }]);
    (noPlanoRepo.listarTodos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: planoId, tipo_plano_id: "pdi", no_pai_id: null, nivel: -1, ordem: 0, dados: { shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published" }, criado_em: now, atualizado_em: now },
      { id: axisId, tipo_plano_id: "pdi", no_pai_id: planoId, nivel: 0, ordem: 0, dados: { code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [], customGrants: [] }, criado_em: now, atualizado_em: now },
      { id: objectiveId, tipo_plano_id: "pdi", no_pai_id: axisId, nivel: 1, ordem: 0, dados: { code: "8.1", title: "Objetivo" }, criado_em: now, atualizado_em: now },
    ]);
  });

  it("atribui ordem sequencial por objetivo mesmo gravando itens em paralelo", async () => {
    const ws: Workspace = {
      version: 2,
      templates: [{ id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] }],
      plans: [{
        id: planoId, type: "PDI", shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published",
        template: { id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
        axes: [{ id: axisId, code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: [], customGrants: [] }],
        objectives: [{ id: objectiveId, axisId, code: "8.1", title: "Objetivo" }],
        items: ["i1", "i2", "i3"].map((id, index) => ({
          id, code: `8.1.${index + 1}`, axisId, objectiveId, title: `Item ${index + 1}`, owner: "", partners: "", description: "", source: "",
          reviewStatus: "draft", reviewNote: "",
          metric: { name: "", measurementMode: "manual", valueType: "number", unit: "", periodicity: "annual", baseline: null, reference: "", direction: "up", targets: {}, formula: "" },
          measurements: [], extras: {}, actions: [], history: [], risks: [],
        })),
      }],
    };

    await salvarWorkspace(admin, ws);

    const chamadasDeItem = (noPlanoRepo.upsertLote as ReturnType<typeof vi.fn>).mock.calls
      .map(([linhas]) => linhas[0])
      .filter((linha) => linha.nivel === 2);
    const ordemPorId = Object.fromEntries(chamadasDeItem.map((linha) => [linha.id, linha.ordem]));
    expect(ordemPorId).toEqual({ i1: 0, i2: 1, i3: 2 });
  });
});

describe("salvarWorkspace — notifica responsáveis quando um item é enviado para validação", () => {
  const planoId = "p1";
  const axisId = "a1";
  const objectiveId = "o1";
  const itemId = "i1";
  const now = new Date().toISOString();
  const gestor: SessaoUsuario = {
    authenticated: true,
    user: { id: "gestor-1", name: "Gestor", email: "gestor@example.test" }, roles: [],
    grants: [{ permission: "plan.read_published", scope: { type: "global" } }, { permission: "item.submit", scope: { type: "axis", planId: planoId, axisId } }, { permission: "item.edit", scope: { type: "axis", planId: planoId, axisId } }],
  };

  function itemRow(reviewStatus: SituacaoValidacao) {
    return { id: itemId, tipo_plano_id: "pdi", no_pai_id: objectiveId, nivel: 2, ordem: 0, dados: { code: "8.1.1", title: "Iniciativa", owner: "", partners: "", description: "", source: "", reviewStatus, reviewNote: "" }, criado_em: now, atualizado_em: now };
  }

  function workspaceComItem(reviewStatus: SituacaoValidacao): Workspace {
    return {
      version: 2,
      templates: [{ id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] }],
      plans: [{
        id: planoId, type: "PDI", shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published",
        template: { id: "pdi", type: "PDI", name: "PDI", version: 1, description: "", labels: { axis: "Eixo", objective: "Objetivo", item: "Iniciativa" }, defaultPeriodicity: "annual", fields: [] },
        axes: [{ id: axisId, code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: ["responsavel-1"], customGrants: [] }],
        objectives: [{ id: objectiveId, axisId, code: "8.1", title: "Objetivo" }],
        items: [{
          id: itemId, code: "8.1.1", axisId, objectiveId, title: "Iniciativa", owner: "", partners: "", description: "", source: "",
          reviewStatus, reviewNote: "",
          metric: { name: "", measurementMode: "manual", valueType: "number", unit: "", periodicity: "annual", baseline: null, reference: "", direction: "up", targets: {}, formula: "" },
          measurements: [], extras: {}, actions: [], history: [], risks: [],
        }],
      }],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([{ id: "pdi", versao: 1, rotulos: { item: "Iniciativa", axis: "Eixo", objective: "Objetivo" }, campos_extras: [] }]);
    (noPlanoRepo.listarTodos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: planoId, tipo_plano_id: "pdi", no_pai_id: null, nivel: -1, ordem: 0, dados: { shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published" }, criado_em: now, atualizado_em: now },
      { id: axisId, tipo_plano_id: "pdi", no_pai_id: planoId, nivel: 0, ordem: 0, dados: { code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: ["responsavel-1"], customGrants: [] }, criado_em: now, atualizado_em: now },
      { id: objectiveId, tipo_plano_id: "pdi", no_pai_id: axisId, nivel: 1, ordem: 0, dados: { code: "8.1", title: "Objetivo" }, criado_em: now, atualizado_em: now },
      itemRow("draft"),
    ]);
    authMocks.listarPorIds.mockResolvedValue([{ id: "responsavel-1", nome: "Responsável", email: "responsavel@example.test", senhaHash: "x", papelAdmin: false, criadoEm: now, atualizadoEm: now }]);
  });

  it("envia e-mail ao(s) responsável(is) do eixo quando o item passa a 'submitted'", async () => {
    await salvarWorkspace(gestor, workspaceComItem("submitted"));

    await vi.waitFor(() => expect(mailerMocks.enviar).toHaveBeenCalledTimes(1));
    expect(authMocks.listarPorIds).toHaveBeenCalledWith(["responsavel-1"]);
    const email = mailerMocks.enviar.mock.calls[0]![0];
    expect(email.to).toBe("responsavel@example.test");
    expect(email.html).toContain("8.1.1");
  });

  it("não notifica quando o item não muda de reviewStatus", async () => {
    (noPlanoRepo.listarTodos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: planoId, tipo_plano_id: "pdi", no_pai_id: null, nivel: -1, ordem: 0, dados: { shortName: "PDI", name: "PDI", start: 2026, end: 2030, status: "published" }, criado_em: now, atualizado_em: now },
      { id: axisId, tipo_plano_id: "pdi", no_pai_id: planoId, nivel: 0, ordem: 0, dados: { code: "8", name: "Governança", color: "#000", ownerUnit: "SEPLAN", managerIds: [], reviewerIds: ["responsavel-1"], customGrants: [] }, criado_em: now, atualizado_em: now },
      { id: objectiveId, tipo_plano_id: "pdi", no_pai_id: axisId, nivel: 1, ordem: 0, dados: { code: "8.1", title: "Objetivo" }, criado_em: now, atualizado_em: now },
      itemRow("submitted"),
    ]);
    await salvarWorkspace(gestor, workspaceComItem("submitted"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mailerMocks.enviar).not.toHaveBeenCalled();
  });
});

describe("removerPlano", () => {
  const admin: SessaoUsuario = { ...session, grants: [...session.grants, { permission: "model.manage", scope: { type: "global" } }] };
  const now = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exige autenticação", async () => {
    const anonimo: SessaoUsuario = { authenticated: false, user: null, roles: [], grants: [] };
    await expect(removerPlano(anonimo, "p1")).rejects.toMatchObject({ status: 401 });
    expect(noPlanoRepo.removerLote).not.toHaveBeenCalled();
  });

  it("nega quem não administra modelos", async () => {
    await expect(removerPlano(session, "p1")).rejects.toMatchObject({ status: 403 });
    expect(noPlanoRepo.removerLote).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o plano não existe", async () => {
    (noPlanoRepo.buscarPorId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(removerPlano(admin, "p1")).rejects.toMatchObject({ status: 404 });
    expect(noPlanoRepo.removerLote).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o id não é a raiz de um plano (ex.: um eixo)", async () => {
    (noPlanoRepo.buscarPorId as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1", tipo_plano_id: "pdi", no_pai_id: "p1", nivel: 0, ordem: 0, dados: {}, criado_em: now, atualizado_em: now });
    await expect(removerPlano(admin, "a1")).rejects.toMatchObject({ status: 404 });
    expect(noPlanoRepo.removerLote).not.toHaveBeenCalled();
  });

  it("remove a raiz do plano para quem administra modelos", async () => {
    (noPlanoRepo.buscarPorId as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", tipo_plano_id: "pdi", no_pai_id: null, nivel: -1, ordem: 0, dados: {}, criado_em: now, atualizado_em: now });
    await removerPlano(admin, "p1");
    expect(noPlanoRepo.removerLote).toHaveBeenCalledWith(["p1"]);
  });
});
