const permissions = [
  'plan.read_published', 'plan.read_internal', 'plan.manage', 'model.manage', 'item.edit',
  'action.manage', 'stage.update', 'indicator.edit_target', 'result.create', 'risk.read',
  'risk.manage', 'history.read', 'history.comment',
  'item.submit', 'item.review', 'work_queue.read', 'review_queue.read',
];

const globalGrants = (values) => values.map((permission) => ({ permission, scope: { type: 'global' } }));

export const developmentSessions = Object.freeze({
  administrator: {
    authenticated: true,
    user: { id: 'dev-admin', name: 'Usuário SEPLAN', email: 'usuario@ufcg.edu.br' },
    roles: [{ code: 'STRATEGIC_ADMIN', name: 'Administrador Estratégico' }],
    grants: globalGrants(permissions),
  },
  public: {
    authenticated: false,
    user: null,
    roles: [],
    grants: globalGrants(['plan.read_published']),
  },
  axis_contributor: {
    authenticated: true,
    user: { id: 'dev-contributor', name: 'Usuário do Eixo', email: 'gestor@ufcg.edu.br' },
    roles: [{ code: 'AXIS_CONTRIBUTOR', name: 'Gestor do Eixo' }],
    grants: [
      ...globalGrants(['plan.read_published', 'work_queue.read']),
      ...['plan.read_internal', 'stage.update', 'result.create', 'risk.read', 'history.read', 'history.comment', 'item.submit'].map((permission) => ({ permission, scope: { type: 'axis', planId: 'pdi', axisId: 'pdi-axis-8' } })),
    ],
  },
  axis_reviewer: {
    authenticated: true,
    user: { id: 'dev-reviewer', name: 'Responsável do Eixo', email: 'responsavel@ufcg.edu.br' },
    roles: [{ code: 'AXIS_REVIEWER', name: 'Responsável pelo Eixo' }],
    grants: [
      ...globalGrants(['plan.read_published', 'review_queue.read']),
      ...['plan.read_internal', 'risk.read', 'history.read', 'history.comment', 'item.review'].map((permission) => ({ permission, scope: { type: 'axis', planId: 'pdi', axisId: 'pdi-axis-8' } })),
      ...['plan.read_internal', 'risk.read', 'history.read', 'history.comment', 'item.review'].map((permission) => ({ permission, scope: { type: 'axis', planId: 'pls', axisId: 'pls-axis-1' } })),
      ...['plan.read_internal', 'risk.read', 'history.read', 'history.comment', 'item.review'].map((permission) => ({ permission, scope: { type: 'axis', planId: 'pls', axisId: 'pls-axis-3' } })),
      ...['plan.read_internal', 'risk.read', 'history.read', 'history.comment', 'item.review'].map((permission) => ({ permission, scope: { type: 'axis', planId: 'pls', axisId: 'pls-axis-7' } })),
    ],
  },
});
