import { axisUrl, itemUrl, planUrl, resolvePlanRoute } from '../planning/navigation.js';

export function breadcrumbsFor(route, plan) {
  if (route.path === '/inicio' || route.path === '/login') return [];
  const entries = [{ label: 'Início', url: '/inicio' }];
  if (plan) {
    entries.push({ label: 'Planos', url: '/planejamentos' }, { label: `${plan.shortName} ${plan.start}–${plan.end}`, url: planUrl(plan.id) });
    const context = resolvePlanRoute(plan, route);
    if (!context.valid) return entries;
    const { axis, objective, item, action, stage, view } = context;
    const labels = plan.template.labels;
    if (axis) entries.push({ label: `${labels.axis} ${axis.code} · ${axis.name}`, url: plan.type === 'PDI' ? axisUrl(plan, axis) : undefined });
    if (objective) entries.push({ label: `${labels.objective} ${objective.code}`, url: plan.type === 'PDI' ? axisUrl(plan, axis, objective.id) : undefined });
    if (item) entries.push({ label: `${labels.item} ${item.code}`, url: itemUrl(plan, item) });
    if (action) entries.push({ label: `Ação ${action.code}`, url: itemUrl(plan, item, 'acao', undefined, action.id) });
    if (view === 'historico') entries.push({ label: 'Histórico' });
    if (view === 'riscos') entries.push({ label: stage ? `Riscos da etapa · ${stage.title}` : 'Riscos da ação' });
  } else {
    const labels = { '/planejamentos': 'Planos', '/pendencias': 'Minhas pendências', '/validacoes': 'Validações', '/modelos': 'Modelos de plano', '/usuarios': 'Usuários', '/sobre': 'Sobre o SUMI', '/ajuda': 'Ajuda', '/privacidade': 'Privacidade' };
    entries.push({ label: labels[route.path] || 'Página não encontrada' });
  }
  return entries;
}
