import { describe, expect, it } from "vitest";
import { pode } from "./auth.can.js";
import { montarSessao } from "./auth.service.js";
import type { EixoParaConcessoes, Usuario } from "./auth.types.js";

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: "user-1",
    nome: "Usuário de Teste",
    email: "teste@ufcg.edu.br",
    senhaHash: "irrelevante",
    papelAdmin: false,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...overrides,
  };
}

describe("montarSessao", () => {
  it("sessão anônima só tem plan.read_published global", () => {
    const sessao = montarSessao(null, []);
    expect(sessao.authenticated).toBe(false);
    expect(pode(sessao, "plan.read_published")).toBe(true);
    expect(pode(sessao, "plan.read_internal", { planId: "p1" })).toBe(false);
  });

  it("administrador tem todas as permissões em escopo global", () => {
    const sessao = montarSessao(usuario({ papelAdmin: true }), []);
    expect(sessao.roles.map((r) => r.code)).toContain("STRATEGIC_ADMIN");
    expect(pode(sessao, "item.edit", { planId: "qualquer", axisId: "qualquer" })).toBe(true);
    expect(pode(sessao, "risk.manage", { planId: "qualquer" })).toBe(true);
  });

  it("gestor do eixo (managerIds) recebe permissões de execução só no seu eixo", () => {
    const eixos: EixoParaConcessoes[] = [{ id: "eixo-1", noPaiId: "plano-1", dados: { managerIds: ["user-1"], reviewerIds: [] } }];
    const sessao = montarSessao(usuario(), eixos);
    expect(sessao.roles.map((r) => r.code)).toContain("AXIS_CONTRIBUTOR");
    expect(pode(sessao, "stage.update", { planId: "plano-1", axisId: "eixo-1" })).toBe(true);
    expect(pode(sessao, "result.create", { planId: "plano-1", axisId: "eixo-1" })).toBe(true);
    expect(pode(sessao, "item.submit", { planId: "plano-1", axisId: "eixo-1" })).toBe(true);
    // Não delegado ao gestor (só ao administrador):
    expect(pode(sessao, "item.edit", { planId: "plano-1", axisId: "eixo-1" })).toBe(false);
    expect(pode(sessao, "action.manage", { planId: "plano-1", axisId: "eixo-1" })).toBe(false);
    expect(pode(sessao, "risk.manage", { planId: "plano-1", axisId: "eixo-1" })).toBe(false);
    // Fora do eixo, nada:
    expect(pode(sessao, "stage.update", { planId: "plano-1", axisId: "outro-eixo" })).toBe(false);
    expect(pode(sessao, "work_queue.read")).toBe(true);
  });

  it("responsável pelo eixo (reviewerIds) só revisa, não executa", () => {
    const eixos: EixoParaConcessoes[] = [{ id: "eixo-1", noPaiId: "plano-1", dados: { managerIds: [], reviewerIds: ["user-1"] } }];
    const sessao = montarSessao(usuario(), eixos);
    expect(sessao.roles.map((r) => r.code)).toContain("AXIS_REVIEWER");
    expect(pode(sessao, "item.review", { planId: "plano-1", axisId: "eixo-1" })).toBe(true);
    expect(pode(sessao, "stage.update", { planId: "plano-1", axisId: "eixo-1" })).toBe(false);
    expect(pode(sessao, "item.submit", { planId: "plano-1", axisId: "eixo-1" })).toBe(false);
    expect(pode(sessao, "review_queue.read")).toBe(true);
  });
});
