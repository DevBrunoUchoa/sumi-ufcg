import { useState } from 'react';
import { AxisIcon } from '../AxisIcon.jsx';
import { Badge, Button, Empty, Icon, Input, Select } from '../ui.jsx';
import { executionStatus } from '../domain.js';
import { PERMISSIONS, resourceFor } from '../auth/permissions.js';
import { ForbiddenPage, NotFoundPage, UnauthorizedPage } from '../error-pages.jsx';
import { axisUrl, itemUrl, planUrl, resolvePlanRoute } from './navigation.js';
import { loginUrl } from '../auth/navigation.js';
import { filterAxes, filterAxisItems, itemsForAxis, summarizeScope } from './selectors.js';
import { ScopeSummary } from './ScopeSummary.jsx';

const go = (path) => { window.location.hash = path; };

export function PdiWorkspace({ plan, route, can, authenticated, actions, renderDetail }) {
  const context = resolvePlanRoute(plan, route);
  if (!context.valid) return <NotFoundPage onGoHome={() => go(planUrl(plan.id))} />;
  const { axis, objective, item, action, stage, view } = context;
  const resource = resourceFor(plan, item);
  if (item && ((view === 'riscos' && !can(PERMISSIONS.VIEW_RISK, resource)) || (view === 'historico' && !can(PERMISSIONS.VIEW_HISTORY, resource)))) {
    return authenticated ? <ForbiddenPage onGoHome={() => go(axisUrl(plan, axis))} /> : <UnauthorizedPage onLogin={() => go(loginUrl(route))} />;
  }
  const title = view === 'riscos' ? stage?.title || action.title : action?.title || item?.title || axis?.name;
  const eyebrow = view === 'riscos' ? stage ? 'RISCOS DA ETAPA' : `RISCOS DA AÇÃO ${action.code}` : action ? `AÇÃO ${action.code}` : item ? `${plan.template.labels.item.toUpperCase()} ${item.code}` : axis ? `${plan.shortName} ${plan.start}–${plan.end} · EIXO ${axis.code}` : 'PLANEJAMENTO INSTITUCIONAL';
  const editable = can(PERMISSIONS.MANAGE_PLAN, resourceFor(plan));
  return <div className="plan-page pdi-workspace" style={{ '--axis-color': axis?.color }}>
    <div className="plan-page-heading pdi-heading"><div className="pdi-identity">{axis && !item && <AxisIcon planType={plan.type} axis={axis} />}<div><p className="eyebrow">{eyebrow}</p><div className="title-line"><h1 tabIndex={-1}>{title || <>{plan.shortName} <span>{plan.start}–{plan.end}</span></>}</h1>{!axis && <Badge tone={plan.status === 'published' ? 'green' : 'neutral'}>{plan.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge>}</div>{!item && <p>{axis ? `Unidade responsável: ${axis.ownerUnit || 'Não informada'}` : plan.name}</p>}</div></div>{actions(context)}</div>
    {!axis ? <PlanOverview key={plan.id} plan={plan} editable={editable} /> : !item ? <AxisOverview key={`${axis.id}:${route.query.get('objective') || ''}`} plan={plan} axis={axis} objectiveId={route.query.get('objective') || ''} editable={editable} /> : <>
      <section className="planning-context" aria-label="Contexto do planejamento"><p><strong>{plan.template.labels.objective} {objective.code}</strong> · {objective.title}</p>{action && <p><a href={`#${itemUrl(plan, item)}`}><strong>{plan.template.labels.item} {item.code}</strong> · {item.title}</a></p>}</section>
      <section className="detail pdi-detail" aria-label="Detalhe do item">{renderDetail(context)}</section>
    </>}
  </div>;
}

function PlanOverview({ plan, editable }) {
  const [search, setSearch] = useState('');
  const axes = filterAxes(plan, search);
  return <>
    <ScopeSummary summary={summarizeScope(plan.items, plan.objectives.length)} axisCount={plan.axes.length} labels={plan.template.labels} />
    {!plan.axes.length ? <Empty title={editable ? 'Estrutura pronta para receber conteúdo' : 'Eixos ainda não disponíveis'}>{editable ? 'Configure os eixos e objetivos na opção Estrutura para começar o acompanhamento.' : 'Os eixos aparecerão aqui quando estiverem disponíveis para consulta.'}</Empty> : <>
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

function AxisOverview({ plan, axis, objectiveId, editable }) {
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
    {!objectives.length ? <Empty title="Nenhum objetivo cadastrado neste eixo">{editable ? 'Configure os objetivos deste eixo na opção Estrutura.' : 'Os objetivos e suas iniciativas aparecerão aqui quando estiverem disponíveis para consulta.'}</Empty> : <>
      <div className="section-heading"><div><h2>{plan.template.labels.objective}s e {plan.template.labels.item.toLowerCase()}s</h2><p className="hint">Cada {plan.template.labels.item.toLowerCase()} pertence a um {plan.template.labels.objective.toLowerCase()} deste {plan.template.labels.axis.toLowerCase()}.</p></div></div>
      <div className="pdi-axis-filters"><Input id="search-axis-items" label="Buscar neste eixo" type="search" placeholder="Código, objetivo ou iniciativa…" value={search} onChange={(event) => setSearch(event.target.value)} /><Select label="Filtrar responsável" placeholder="Todos os responsáveis" value={owner} onChange={(event) => setOwner(event.target.value)} options={[{ value: '', label: 'Todos os responsáveis' }, ...Array.from(new Set(items.map((item) => item.owner))).filter(Boolean).map((value) => ({ value, label: value }))]} /><Select label="Filtrar situação" placeholder="Todas as situações" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: '', label: 'Todas as situações' }, ...['Não iniciada', 'Em andamento', 'Concluída', 'Cancelada'].map((value) => ({ value, label: value }))]} /></div>
      {filtering && <div className="pdi-filter-summary"><span>{objectiveId && `Objetivo ${objectives.find((entry) => entry.id === objectiveId)?.code} · `}{filtered.length} iniciativas encontradas</span>{groups.length > 0 && <Button variant="tertiary" onClick={clear}>Limpar filtros</Button>}</div>}
      <p className="sr-only" role="status">{filtered.length} iniciativas encontradas neste eixo</p>
      {groups.map((objective) => <ObjectiveGroup key={JSON.stringify([objective.id, search, owner, status])} plan={plan} objective={objective} items={filtered.filter((item) => item.objectiveId === objective.id)} />)}
      {filtering && !groups.length && <Empty title="Nenhuma iniciativa encontrada" action={<Button onClick={clear}>Limpar filtros</Button>}>Ajuste os filtros para continuar.</Empty>}
    </>}
  </>;
}

function ObjectiveGroup({ plan, objective, items }) {
  const [expanded, setExpanded] = useState(true);
  const contentId = `objective-content-${objective.id}`;
  return <section className="pdi-objective" aria-labelledby={`objective-${objective.id}`}>
    <div className="pdi-objective-heading">
      <div><p className="eyebrow">{plan.template.labels.objective.toUpperCase()} {objective.code}</p><h3 id={`objective-${objective.id}`}>{objective.title}</h3></div>
      <button type="button" className="br-button tertiary small pdi-objective-toggle" aria-expanded={expanded} aria-controls={contentId} aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${plan.template.labels.objective.toLowerCase()} ${objective.code}`} onClick={() => setExpanded((current) => !current)}>
        {expanded ? 'Recolher' : 'Expandir'}<Icon name="chevron" size={14} aria-hidden="true" />
      </button>
    </div>
    <div id={contentId} className="br-list pdi-objective-content" hidden={!expanded}>
      {items.map((item) => <a className="br-item pdi-initiative-link" key={item.id} href={`#${itemUrl(plan, item)}`}><span><small>{plan.template.labels.item} {item.code}</small><strong>{item.title}</strong><span className="hint">{item.owner || 'Responsável não informado'} · {item.actions.length} ações estratégicas</span></span><span className="pdi-initiative-end"><Badge>{executionStatus(item)}</Badge><Icon name="arrow" size={14} /></span></a>)}
      {!items.length && <p className="pdi-objective-empty">Nenhuma {plan.template.labels.item.toLowerCase()} cadastrada neste {plan.template.labels.objective.toLowerCase()}.</p>}
    </div>
  </section>;
}
