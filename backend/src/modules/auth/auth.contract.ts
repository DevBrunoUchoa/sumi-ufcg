import { z } from "zod";

/** Endpoint consumido pelo SessionProvider do frontend. */
export const AUTH_SESSION_PATH = "/api/v1/auth/session" as const;

/**
 * Capacidades exercidas pelo frontend aprovado (sumi-prototipo).
 *
 * Os códigos são parte do contrato público da API. Novos códigos podem ser
 * acrescentados de forma compatível, mas os existentes não devem ser
 * renomeados sem versionar o endpoint.
 *
 * Origem: PR #6 (Fel-tby, "feat(auth): define contrato v1 de sessão e
 * permissões") definiu as primeiras 13. As 4 restantes (item.submit,
 * item.review, work_queue.read, review_queue.read) foram acrescentadas
 * aqui porque o frontend aprovado em 13/09 já as usa (fluxo de submissão/
 * validação — "Minhas pendências" e "Validações", ver
 * src/auth/permissions.js e dev/session-fixtures.js do frontend) e não
 * existiam na versão do protótipo que a PR #6 tomou como referência. Ver
 * docs/adr/0005-integracao-workspace-real.md.
 */
export const PERMISSION_CODES = [
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
] as const;

export const permissionCodeSchema = z.enum(PERMISSION_CODES);
export type PermissionCode = z.infer<typeof permissionCodeSchema>;

/**
 * Papéis funcionais descritos no Plano de Negócio e usados pelas fixtures do
 * frontend. Papéis são informativos: autorização é sempre decidida por grants.
 */
export const ROLE_CODES = ["STRATEGIC_ADMIN", "AXIS_CONTRIBUTOR", "AXIS_REVIEWER"] as const;

export const roleCodeSchema = z.enum(ROLE_CODES);
export type RoleCode = z.infer<typeof roleCodeSchema>;

const resourceIdSchema = z.string().trim().min(1);

export const globalScopeSchema = z
  .object({
    type: z.literal("global"),
  })
  .strict();

export const planScopeSchema = z
  .object({
    type: z.literal("plan"),
    planId: resourceIdSchema,
  })
  .strict();

export const axisScopeSchema = z
  .object({
    type: z.literal("axis"),
    planId: resourceIdSchema,
    axisId: resourceIdSchema,
  })
  .strict();

export const itemScopeSchema = z
  .object({
    type: z.literal("item"),
    planId: resourceIdSchema,
    itemId: resourceIdSchema,
  })
  .strict();

export const permissionScopeSchema = z.discriminatedUnion("type", [
  globalScopeSchema,
  planScopeSchema,
  axisScopeSchema,
  itemScopeSchema,
]);
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

export const permissionGrantSchema = z
  .object({
    permission: permissionCodeSchema,
    scope: permissionScopeSchema,
  })
  .strict();
export type PermissionGrant = z.infer<typeof permissionGrantSchema>;

export const sessionUserSchema = z
  .object({
    id: resourceIdSchema,
    name: z.string().trim().min(1),
    email: z.string().trim().email().nullable(),
  })
  .strict();
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionRoleSchema = z
  .object({
    code: roleCodeSchema,
    name: z.string().trim().min(1),
  })
  .strict();
export type SessionRole = z.infer<typeof sessionRoleSchema>;

/** Resposta 200 de uma sessão institucional autenticada. */
export const authenticatedSessionSchema = z
  .object({
    authenticated: z.literal(true),
    user: sessionUserSchema,
    roles: z.array(sessionRoleSchema),
    grants: z.array(permissionGrantSchema),
  })
  .strict()
  .superRefine((session, ctx) => {
    const preservesPublicAccess = session.grants.some(
      (grant) => grant.permission === "plan.read_published" && grant.scope.type === "global",
    );

    if (!preservesPublicAccess) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grants"],
        message: "a sessão autenticada precisa preservar plan.read_published no escopo global",
      });
    }
  });
export type AuthenticatedSession = z.infer<typeof authenticatedSessionSchema>;

/** Resposta 401 quando não existe uma sessão institucional válida. */
export const unauthenticatedSessionErrorSchema = z
  .object({
    error: z
      .object({
        code: z.literal("UNAUTHENTICATED"),
        message: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();
export type UnauthenticatedSessionError = z.infer<typeof unauthenticatedSessionErrorSchema>;
