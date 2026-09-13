import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_PATH,
  authenticatedSessionSchema,
  PERMISSION_CODES,
  permissionGrantSchema,
  ROLE_CODES,
  unauthenticatedSessionErrorSchema,
} from "./auth.contract.js";

const user = {
  id: "user-123",
  name: "Pessoa da UFCG",
  email: "pessoa@ufcg.edu.br",
};

describe("contrato da sessão de autorização", () => {
  it("mantém o endpoint esperado pelo frontend", () => {
    expect(AUTH_SESSION_PATH).toBe("/api/v1/auth/session");
  });

  it("mantém exatamente o vocabulário exercido pelo frontend aprovado", () => {
    // PR #6 definiu as 13 primeiras; item.submit/item.review/work_queue.read/
    // review_queue.read foram acrescentadas junto com o fluxo de submissão e
    // validação do frontend aprovado (ver auth.contract.ts).
    expect(PERMISSION_CODES).toEqual([
      "plan.read_published",
      "plan.read_internal",
      "plan.manage",
      "model.manage",
      "item.edit",
      "action.manage",
      "stage.update",
      "indicator.edit_target",
      "result.create",
      "risk.read",
      "risk.manage",
      "history.read",
      "history.comment",
      "item.submit",
      "item.review",
      "work_queue.read",
      "review_queue.read",
    ]);
    expect(ROLE_CODES).toEqual(["STRATEGIC_ADMIN", "AXIS_CONTRIBUTOR", "AXIS_REVIEWER"]);
  });

  it.each([
    { type: "global" },
    { type: "plan", planId: "pdi-2026" },
    { type: "axis", planId: "pdi-2026", axisId: "eixo-8" },
    { type: "item", planId: "pdi-2026", itemId: "iniciativa-1" },
  ])("aceita o escopo $type", (scope) => {
    expect(
      permissionGrantSchema.safeParse({
        permission: "result.create",
        scope,
      }).success,
    ).toBe(true);
  });

  it("aceita grants dos fluxos de submissão e validação", () => {
    expect(permissionGrantSchema.safeParse({ permission: "item.submit", scope: { type: "axis", planId: "pdi-2026", axisId: "eixo-8" } }).success).toBe(true);
    expect(permissionGrantSchema.safeParse({ permission: "item.review", scope: { type: "axis", planId: "pdi-2026", axisId: "eixo-8" } }).success).toBe(true);
    expect(permissionGrantSchema.safeParse({ permission: "work_queue.read", scope: { type: "global" } }).success).toBe(true);
    expect(permissionGrantSchema.safeParse({ permission: "review_queue.read", scope: { type: "global" } }).success).toBe(true);
  });

  it("aceita a sessão autenticada esperada pelo frontend", () => {
    const result = authenticatedSessionSchema.safeParse({
      authenticated: true,
      user,
      roles: [{ code: "AXIS_CONTRIBUTOR", name: "Gestor do Eixo" }],
      grants: [
        { permission: "plan.read_published", scope: { type: "global" } },
        {
          permission: "stage.update",
          scope: { type: "axis", planId: "pdi-2026", axisId: "eixo-8" },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("aceita usuário sem e-mail institucional disponível", () => {
    const result = authenticatedSessionSchema.safeParse({
      authenticated: true,
      user: { ...user, email: null },
      roles: [],
      grants: [{ permission: "plan.read_published", scope: { type: "global" } }],
    });

    expect(result.success).toBe(true);
  });

  it("rejeita sessão autenticada que faria a pessoa perder a consulta pública", () => {
    const result = authenticatedSessionSchema.safeParse({
      authenticated: true,
      user,
      roles: [],
      grants: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejeita wildcard, permissões desconhecidas e escopos incompletos", () => {
    expect(
      permissionGrantSchema.safeParse({ permission: "*", scope: { type: "global" } }).success,
    ).toBe(false);
    expect(
      permissionGrantSchema.safeParse({ permission: "user.manage", scope: { type: "global" } })
        .success,
    ).toBe(false);
    expect(
      permissionGrantSchema.safeParse({
        permission: "item.edit",
        scope: { type: "axis", planId: "pdi-2026" },
      }).success,
    ).toBe(false);
  });

  it("rejeita campos extras que poderiam alterar a semântica do escopo", () => {
    expect(
      permissionGrantSchema.safeParse({
        permission: "item.edit",
        scope: { type: "plan", planId: "pdi-2026", axisId: "eixo-8" },
      }).success,
    ).toBe(false);
  });

  it("define o corpo estável da resposta 401", () => {
    expect(
      unauthenticatedSessionErrorSchema.safeParse({
        error: {
          code: "UNAUTHENTICATED",
          message: "Sessão institucional ausente ou expirada.",
        },
      }).success,
    ).toBe(true);
  });
});
