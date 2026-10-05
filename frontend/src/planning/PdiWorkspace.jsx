import { useEffect, useRef, useState } from 'react';
import { AxisIcon } from '../AxisIcon.jsx';
import { Badge, Button, Empty, Icon, Input, Select } from '../ui.jsx';
import { executionStatus } from '../domain.js';
import { PERMISSIONS, resourceFor } from '../auth/permissions.js';
import { ForbiddenPage, NotFoundPage, UnauthorizedPage } from '../error-pages.jsx';
import { axisUrl, itemUrl, planUrl, resolvePlanRoute } from './navigation.js';
import { filterAxes, filterAxisItems, itemsForAxis, summarizeScope } from './selectors.js';
import { ScopeSummary } from './ScopeSummary.jsx';

const go = (path) => { window.location.hash = path; };

function PlanningBreadcrumb({ plan, context }) {
  const { axis, objective, item, action, stage, view } = context;
  const labels = plan.template.labels;
  const entries = [{ label: `${plan.shortName} ${plan.start}–${plan.end}`, url: planUrl(plan.id) }];
  if (axis) entries.push({ label: `${labels.axis} ${axis.code} · ${axis.name}`, url: axisUrl(plan, axis) });
  if (objective) entries.push({ label: `${labels.objective} ${objective.code}`, url: axisUrl(plan, axis, objective.id) });
  if (item) entries.push({ label: `${labels.item} ${item.code}`, url: itemUrl(plan, item) });
  if (action) entries.push({ label: `Ação ${action.code}`, url: itemUrl(plan, item, 'acao', undefined, action.id) });
  if (view === 'historico') entries.push({ label: 'Histórico' });
  if (view === 'riscos') entries.push({ label: stage ? `Riscos da etapa · ${stage.title}` : 'Riscos da ação' });
  return <nav className="br-breadcrumb planning-breadcrumb" aria-label="Hierarquia do planejamento"><ol className="crumb-list">{entries.map((entry, index) => <li className="crumb" key={`${entry.label}-${index}`}>{index > 0 && <Icon name="chevron" size={12} aria-hidden="true" />}{index === entries.length - 1 ? <span aria-current="page">{entry.label}</span> : <a href={`#${entry.url}`}>{entry.label}</a>}</li>)}</ol></nav>;
}

export function PdiWorkspace({ plan, route, can, authenticated, actions, renderDetail }) {
  const context = resolvePlanRoute(plan, route);
  const heading = useRef(null);
  const routeKey = [route.path, ...['item', 'action', 'stage', 'view', 'tab', 'objective'].map((key) => route.query.get(key))].join('|');
  const previousRoute = useRef(routeKey);
  useEffect(() => {
    if (previousRoute.current === routeKey) return;
    previousRoute.current = routeKey;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [routeKey]);
  if (!context.valid) return <NotFoundPage onGoHome={() => go(planUrl(plan.id))} />;
  const { axis, objective, item, action, view } = context;
  const resource = resourceFor(plan, item);
  if (item && ((view === 'riscos' && !can(PERMISSIONS.VIEW_RISK, resource)) || (view === 'historico' && !can(PERMISSIONS.VIEW_HISTORY, resource)))) {
    return authenticated ? <ForbiddenPage onGoHome={() => go(axisUrl(plan, axis))} /> : <UnauthorizedPage onLogin={() => go('/login')} />;
  }
  return <div className="plan-page pdi-workspace" style={{ '--axis-color': axis?.color }}>
    <PlanningBreadcrumb plan={plan} context={context} />
    <div className="plan-page-heading pdi-heading"><div className="pdi-identity">{axis && <AxisIcon planType={plan.type} axis={axis} />}<div><a className="back-link" href={axis ? `#${item ? axisUrl(plan, axis) : planUrl(plan.id)}` : '#/planejamentos'}>{axis ? item ? '← Objetivos e iniciativas do eixo' : '← Todos os eixos' : '← Todos os planejamentos'}</a><p className="eyebrow">{axis ? `${plan.shortName} ${plan.start}–${plan.end} · EIXO ${axis.code}` : 'PLANEJAMENTO INSTITUCIONAL'}</p><div className="title-line"><h1 ref={heading} tabIndex={-1}>{axis ? axis.name : <>{plan.shortName} <span>{plan.start}–{plan.end}</span></>}</h1>{!axis && <Badge tone={plan.status === 'published' ? 'green' : 'neutral'}>{plan.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge>}</div><p>{axis ? `Unidade responsável: ${axis.ownerUnit || 'Não informada'}` : plan.name}</p></div></div>{actions(context)}</div>
    {!axis ? <PlanOverview key={plan.id} plan={plan} /> : !item ? <AxisOverview key={`${axis.id}:${route.query.get('objective') || ''}`} plan={plan} axis={axis} objectiveId={route.query.get('objective') || ''} /> : <>
      <section className="planning-context" aria-label="Contexto do planejamento"><p><strong>{plan.template.labels.objective} {objective.code}</strong> · {objective.title}</p>{action && <p><a href={`#${itemUrl(plan, item)}`}><strong>{plan.template.labels.item} {item.code}</strong> · {item.title}</a></p>}</section>
      <section className="detail pdi-detail" aria-label="Detalhe do item">{renderDetail(context)}</section>
    </>}
  </div>;
}

function PlanOverview({ plan }) {
  const [search, setSearch] = useState('');
  const axes = filterAxes(plan, search);
  return <>
    <ScopeSummary summary={summarizeScope(plan.items, plan.objectives.length)} axisCount={plan.axes.length} labels={plan.template.labels} />
    {!plan.axes.length ? <Empty title="Estrutura pronta para receber conteúdo">Configure os eixos e objetivos na opção Estrutura para começar o acompanhamento.</Empty> : <>
      <div className="section-heading pdi-section-heading"><div><h2>Eixos temáticos</h2><p className="hint">Escolha um eixo para explorar seus objetivos e iniciativas.</p></div><Input id="search-pdi-axes" label="Buscar no PDI" type="search" placeholder="Eixo, objetivo ou iniciativa…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <p className="sr-only" role="status">{axes.length} eixos encontrados</p>
      <div className="pdi-axis-grid">{axes.map((axis) => {
        const count = itemsForAxis(plan, axis.id).length;
        const objectiveCount = plan.objectives.filter((entry) => entry.axisId === axis.id).length;
        return <article className="br-card pdi-axis-card" key={axis.id} style={{ '--axis-color': axis.color }}><div className="card-content"><div className="pdi-axis-card-identity"><AxisIcon planType={plan.type} axis={axis} /><span>{plan.template.labels.axis.toUpperCase()} {axis.code}</span></div><h3>{axis.name}</h3><p className="hint">{axis.ownerUnit || 'Unidade não informada'}</p><dl className="pdi-axis-counts"><div><dt>{plan.template.labels.objective}s</dt><dd>{objectiveCount}</dd></div><div><dt>{plan.template.labels.item}s</dt><dd>{count}</dd></div></dl></div><div className="card-footer"><a className="br-button tertiary pdi-axis-link" href={`#${axisUrl(plan, axis)}`} aria-label={`Explorar ${plan.template.labels.axis.toLowerCase()} ${axis.code}: ${axis.name}`}>Explorar {plan.template.labels.axis.toLowerCase()} <Icon name="arrow" size={14} /></a></div></article>;
      })}</div>
      {!axes.length && <Empty title="Nenhum eixo encontrado" action={<Button onClick={() => setSearch('')}>Limpar busca</Button>}>Busque pelo código ou nome de um eixo, objetivo ou iniciativa.</Empty>}
    </>}
  </>;
}

function AxisOverview({ plan, axis, objectiveId }) {
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const items = itemsForAxis(plan, axis.id);
  const objectives = plan.objectives.filter((entry) => entry.axisId === axis.id);
  const filtered = filterAxisItems(plan, axis.id, { search, owner, status, objectiveId });
  const filtering = Boolean(search || owner || status || objectiveId);
  const groups = objectives.filter((entry) => (!objectiveId || entry.id === objectiveId) && (!(search || owner || status) || filtered.some((item) => item.objectiveId === entry.id)));
  const clear = () => { setSearch(''); setOwner(''); setStatus(''); if (objectiveId) go(axisUrl(plan, axis)); };
  return <>
    <ScopeSummary summary={summarizeScope(items, objectives.length)} labels={plan.template.labels} />
    {!objectives.length ? <Empty title="Nenhum objetivo cadastrado neste eixo">Os objetivos e suas iniciativas aparecerão aqui após a configuração da estrutura.</Empty> : <>
      <div className="section-heading"><div><h2>{plan.template.labels.objective}s e {plan.template.labels.item.toLowerCase()}s</h2><p className="hint">Cada {plan.template.labels.item.toLowerCase()} pertence a um {plan.template.labels.objective.toLowerCase()} deste {plan.template.labels.axis.toLowerCase()}.</p></div></div>
      <div className="pdi-axis-filters"><Input id="search-axis-items" label="Buscar neste eixo" type="search" placeholder="Código, objetivo ou iniciativa…" value={search} onChange={(event) => setSearch(event.target.value)} /><Select label="Filtrar responsável" placeholder="Todos os responsáveis" value={owner} onChange={(event) => setOwner(event.target.value)} options={[{ value: '', label: 'Todos os responsáveis' }, ...Array.from(new Set(items.map((item) => item.owner))).filter(Boolean).map((value) => ({ value, label: value }))]} /><Select label="Filtrar situação" placeholder="Todas as situações" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: '', label: 'Todas as situações' }, ...['Não iniciada', 'Em andamento', 'Concluída', 'Cancelada'].map((value) => ({ value, label: value }))]} /></div>
      {filtering && <div className="pdi-filter-summary"><span>{objectiveId && `Objetivo ${objectives.find((entry) => entry.id === objectiveId)?.code} · `}{filtered.length} iniciativas encontradas</span>{groups.length > 0 && <Button variant="tertiary" onClick={clear}>Limpar filtros</Button>}</div>}
      <p className="sr-only" role="status">{filtered.length} iniciativas encontradas neste eixo</p>
      {groups.map((objective) => <section className="pdi-objective" key={objective.id} aria-labelledby={`objective-${objective.id}`}><div className="pdi-objective-heading"><p className="eyebrow">{plan.template.labels.objective.toUpperCase()} {objective.code}</p><h3 id={`objective-${objective.id}`}>{objective.title}</h3></div><div className="br-list">{filtered.filter((item) => item.objectiveId === objective.id).map((item) => <a className="br-item pdi-initiative-link" key={item.id} href={`#${itemUrl(plan, item)}`}><span><small>{plan.template.labels.item} {item.code}</small><strong>{item.title}</strong><span className="hint">{item.owner || 'Responsável não informado'} · {item.actions.length} ações estratégicas</span></span><span className="pdi-initiative-end"><Badge>{executionStatus(item)}</Badge><Icon name="arrow" size={14} /></span></a>)}{!items.some((item) => item.objectiveId === objective.id) && <p className="pdi-objective-empty">Nenhuma {plan.template.labels.item.toLowerCase()} cadastrada neste {plan.template.labels.objective.toLowerCase()}.</p>}</div></section>)}
      {filtering && !groups.length && <Empty title="Nenhuma iniciativa encontrada" action={<Button onClick={clear}>Limpar filtros</Button>}>Ajuste os filtros para continuar.</Empty>}
    </>}
  </>;
}
