import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { actionProgress, axisFor, axisLabel, controlFactor, currentPeriod, executionProgress, executionStatus, formatDate, formatMetricValue, formatNumber, historyEntry, latestMeasurement, metricAchievement, metricResult, metricStatus, metricTone, normalize, objectiveFor, periodLabel, periods, residualRisk, reviewStatusLabel, riskLevel, riskLevelLabel, riskScore, stageStatusLabel, stageStatusLabels, taskOverdue, uid } from './domain.js';
import { Badge, Button, Empty, Field, Icon } from './ui.jsx';
import { ActionForm, ItemForm, MeasurementForm, PlanForm, ReviewForm, RiskForm, StructureForm, TargetsForm, TemplateForm } from './forms.jsx';
import { SessionProvider, useSession } from './auth/context.jsx';
import { PERMISSIONS, resourceFor } from './auth/permissions.js';
import { LoginPage } from './auth/Login.jsx';
import { ForbiddenPage, NotFoundPage, OfflinePage, ServerErrorPage, UnauthorizedPage } from './error-pages.jsx';
import { createPlanningClient } from './planning-client.js';
import './styles.css';

const KNOWN_TOP_LEVEL_PATHS = ['/inicio', '/planejamentos', '/pendencias', '/validacoes', '/modelos', '/login'];
const isOfflineError = (error) => error instanceof TypeError || error?.name === 'AbortError';

const PAGE_DESCRIPTIONS = {
  '/inicio': 'Visão geral dos planejamentos institucionais da UFCG: planos publicados, pendências e validações.',
  '/planejamentos': 'Planos institucionais da UFCG (PDI, PLS e outros) com estrutura, execução e indicadores.',
  '/pendencias': 'Itens sob sua responsabilidade de atualização nos planejamentos institucionais da UFCG.',
  '/validacoes': 'Fila de informações enviadas para validação nos planejamentos institucionais da UFCG.',
  '/modelos': 'Modelos de plano institucional configuráveis pela SEPLAN — estrutura e campos adicionais.',
  '/login': 'Acesso à sessão institucional do SUMI, o Sistema Unificado de Monitoramento Institucional da UFCG.',
};
const DEFAULT_DESCRIPTION = 'SUMI — Sistema Unificado de Monitoramento Institucional da UFCG.';

function setMetaDescription(text) {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', text);
}

const authApiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
async function logout() {
  await fetch(`${authApiBase}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
}

const planningClient = createPlanningClient();
const SIDEBAR_PREFERENCE_KEY = 'sumi.ui.sidebar-collapsed';
const planUrl = (id, item, tab = 'acoes', period) => `/plano/${id}${item ? `?item=${item}&tab=${tab}${period ? `&period=${period}` : ''}` : ''}`;
const navigate = (path) => { window.location.hash = path; };
const readRoute = () => { const [path, query] = (window.location.hash.slice(1) || '/inicio').split('?'); return { path, query: new URLSearchParams(query) }; };
const statusTone = (status) => status === 'Concluída' || status === 'Meta atingida' || status === 'Validado' ? 'green' : status === 'Em andamento' || status === 'Aguardando validação' ? 'blue' : status === 'Correção solicitada' ? 'attention' : 'neutral';
const readSidebarPreference = () => { try { return localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true'; } catch { return false; } };

function Progress({ done, total, percent, label = 'etapas', compact = false }) {
  const value = percent ?? (total ? done / total * 100 : 0);
  return <div className={`progress-block ${compact ? 'compact' : ''}`}><div className="progress-track" role="progressbar" aria-label={`Execução das ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><span style={{ width: `${value}%` }} /></div><span>{Math.round(value)}% {label}</span></div>;
}

function AppGate() {
  const auth = useSession();
  const [workspace, setWorkspace] = useState({ status: 'loading', data: null, error: null });
  const load = () => {
    const controller = new AbortController();
    setWorkspace({ status: 'loading', data: null, error: null });
    planningClient.load({ signal: controller.signal }).then((data) => setWorkspace({ status: 'ready', data, error: null })).catch((error) => { if (error.name !== 'AbortError') setWorkspace({ status: 'error', data: null, error }); });
    return () => controller.abort();
  };
  useEffect(load, []);
  if (auth.status === 'loading' || workspace.status === 'loading') return <main className="session-state" aria-busy="true"><p>Carregando…</p></main>;
  if (auth.status === 'error') return <main className="session-state">{isOfflineError(auth.error) ? <OfflinePage onRetry={auth.reload} /> : <ServerErrorPage onRetry={auth.reload} />}</main>;
  if (workspace.status === 'error') return <main className="session-state">{isOfflineError(workspace.error) ? <OfflinePage onRetry={load} /> : <ServerErrorPage onRetry={load} />}</main>;
  return <App auth={auth} initialData={workspace.data} />;
}

function App({ auth, initialData }) {
  const { session, can } = auth;
  const [data, setData] = useState(initialData);
  const [route, setRoute] = useState(readRoute);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [saveError, setSaveError] = useState('');
  const [readyToSave, setReadyToSave] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference);
  useEffect(() => { const changed = () => { setRoute(readRoute()); setModal(null); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  useEffect(() => { if (!readyToSave) return setReadyToSave(true); const timer = setTimeout(() => planningClient.save(data).then(() => setSaveError('')).catch(() => setSaveError('Não foi possível salvar as alterações.')), 150); return () => clearTimeout(timer); }, [data]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  const update = (mutate, message) => { setData((current) => { const next = structuredClone(current); mutate(next); return next; }); if (message) setToast(message); };
  const changeItem = (planId, itemId, change, message) => update((draft) => { const plan = draft.plans.find((candidate) => candidate.id === planId); const index = plan.items.findIndex((item) => item.id === itemId); plan.items[index] = change(plan.items[index]); }, message);
  const close = () => setModal(null);
  const toggleSidebar = () => setSidebarCollapsed((current) => { const next = !current; try { localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(next)); } catch { /* armazenamento indisponível */ } return next; });
  const planId = route.path.startsWith('/plano/') ? route.path.split('/')[2] : null;
  const visiblePlans = data.plans.filter((plan) => can(PERMISSIONS.VIEW_INTERNAL_PLAN, resourceFor(plan)) || (plan.status === 'published' && can(PERMISSIONS.VIEW_PUBLISHED_PLAN, resourceFor(plan))));
  const plan = visiblePlans.find((candidate) => candidate.id === planId);
  const actor = session.user?.name || session.user?.email || 'Usuário do sistema';
  const roles = session.roles?.map((role) => role.name).join(' · ') || 'Consulta pública';
  useEffect(() => {
    const label = plan?.shortName || ({ '/inicio': 'Início', '/planejamentos': 'Planejamentos', '/pendencias': 'Minhas pendências', '/validacoes': 'Validações', '/modelos': 'Modelos', '/login': 'Entrar' })[route.path] || 'SUMI';
    document.title = `SUMI · ${label}`;
    setMetaDescription((plan && `${plan.name} — acompanhamento de eixos, iniciativas, indicadores e execução no SUMI.`) || PAGE_DESCRIPTIONS[route.path] || DEFAULT_DESCRIPTION);
  }, [plan?.shortName, plan?.name, route.path]);

  function saveItem(nextItem, id) {
    update((draft) => { const currentPlan = draft.plans.find((candidate) => candidate.id === id); const index = currentPlan.items.findIndex((item) => item.id === nextItem.id); if (index < 0) currentPlan.items.push(nextItem); else currentPlan.items[index] = { ...nextItem, reviewStatus: ['submitted', 'validated'].includes(currentPlan.items[index].reviewStatus) ? 'draft' : nextItem.reviewStatus }; }, 'Informações salvas.');
    close(); navigate(planUrl(id, nextItem.id));
  }

  function navigationLink(path, icon, text) {
    return <a className={route.path === path ? 'active' : ''} href={`#${path}`} aria-label={text} title={sidebarCollapsed ? text : undefined}><Icon name={icon} /><span>{text}</span></a>;
  }

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById('main-content').focus(); }}>Pular para o conteúdo</a>
    <aside className="sidebar" id="main-sidebar">
      <a className="brand" href="#/inicio" aria-label="SUMI início"><span className="brand-mark"><i /><i /><i /></span><span>sumi<span className="brand-dot">.</span><small>UFCG</small></span></a>
      <button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!sidebarCollapsed} aria-controls="main-sidebar" title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} onClick={toggleSidebar}><Icon name="chevron" size={15} /></button>
      <div className="workspace-label">PLANEJAMENTO INSTITUCIONAL</div>
      <nav aria-label="Navegação principal">
        {navigationLink('/inicio', 'grid', 'Visão geral')}
        {navigationLink('/planejamentos', 'book', 'Planejamentos')}
        {can(PERMISSIONS.VIEW_WORK_QUEUE) && navigationLink('/pendencias', 'list', 'Minhas pendências')}
        {can(PERMISSIONS.VIEW_REVIEW_QUEUE) && navigationLink('/validacoes', 'check', 'Validações')}
        {can(PERMISSIONS.MANAGE_MODEL) && navigationLink('/modelos', 'layers', 'Modelos de plano')}
      </nav>
      <div className="sidebar-bottom"><div className="institution">Universidade Federal<br />de Campina Grande</div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><a href="#/inicio">SUMI</a>{plan && <><Icon name="chevron" size={13} /><a href="#/planejamentos">Planejamentos</a><Icon name="chevron" size={13} /><strong>{plan.shortName}</strong></>}</div><div className="account-summary"><span className="account-avatar"><Icon name="user" size={16} /></span><span><strong>{session.user?.name || 'Comunidade UFCG'}</strong><small>{roles}</small></span>{session.authenticated ? <button type="button" className="text-button" onClick={() => logout().then(auth.reload)}>Sair</button> : <a className="text-button" href="#/login">Entrar</a>}</div></header>
      {saveError && <div role="alert" className="warning-strip">{saveError}</div>}
      <main id="main-content" tabIndex={-1}>
        {route.path === '/login' ? <LoginPage onSuccess={() => { auth.reload(); navigate('/inicio'); }} />
          : route.path === '/inicio' ? <Home data={{ ...data, plans: visiblePlans }} session={session} can={can} />
          : route.path === '/planejamentos' ? <PlanList data={{ ...data, plans: visiblePlans }} can={can} onCreate={() => setModal({ type: 'plan' })} />
            : route.path === '/pendencias' && can(PERMISSIONS.VIEW_WORK_QUEUE) ? <WorkQueue plans={visiblePlans} can={can} />
              : route.path === '/validacoes' && can(PERMISSIONS.VIEW_REVIEW_QUEUE) ? <ReviewQueue plans={visiblePlans} can={can} />
                : route.path === '/modelos' && can(PERMISSIONS.MANAGE_MODEL) ? <Models templates={data.templates} onEdit={(template) => setModal({ type: 'template', template })} onUse={(template) => setModal({ type: 'plan', templateId: template.id })} />
                  : plan ? <PlanPage key={plan.id} plan={plan} actor={actor} can={can} route={route} onModal={setModal} changeItem={changeItem} />
                    // /plano/:id sem correspondência não distingue "não existe" de "existe mas sem acesso" —
                    // o backend já nem devolve planos sem acesso, então tratar como 404 evita confirmar a
                    // existência de um plano para quem não pode vê-lo. Itens de navegação conhecidos
                    // (pendências/validações/modelos) têm a existência pública; só o acesso é negado, daí 401/403.
                    : KNOWN_TOP_LEVEL_PATHS.includes(route.path)
                      ? (session.authenticated ? <ForbiddenPage onGoHome={() => navigate('/inicio')} /> : <UnauthorizedPage onLogin={() => navigate('/login')} />)
                      : <NotFoundPage onGoHome={() => navigate('/inicio')} />}
      </main>
    </div>
    {toast && <div role="status" className="toast"><Icon name="check" size={17} />{toast}</div>}
    {modal?.type === 'plan' && <PlanForm templates={data.templates} initialTemplate={modal.templateId} onClose={close} onSave={(newPlan) => { update((draft) => draft.plans.push(newPlan), 'Planejamento criado.'); close(); navigate(planUrl(newPlan.id)); }} />}
    {modal?.type === 'template' && <TemplateForm template={modal.template} onClose={close} onSave={(template) => { update((draft) => { draft.templates = draft.templates.map((current) => current.id === template.id ? template : current); }, 'Modelo salvo.'); close(); }} />}
    {modal?.type === 'structure' && <StructureForm plan={plan} onClose={close} onSave={(structure) => { update((draft) => { const current = draft.plans.find((candidate) => candidate.id === plan.id); current.axes = structure.axes; current.objectives = structure.objectives; }, 'Estrutura atualizada.'); close(); }} />}
    {modal?.type === 'item' && plan && <ItemForm plan={plan} item={modal.item} actor={actor} onClose={close} onSave={(item) => saveItem(item, plan.id)} />}
    {modal?.type === 'action' && plan && <ActionForm plan={plan} item={modal.item} onClose={close} onSave={(action) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: ['submitted', 'validated'].includes(item.reviewStatus) ? 'draft' : item.reviewStatus, actions: [...item.actions, action], history: [...item.history, historyEntry(`Ação adicionada: ${action.title}.`, actor)] }), 'Ação adicionada.'); close(); }} />}
    {modal?.type === 'risk' && plan && <RiskForm item={modal.item} action={modal.action} risk={modal.risk} onClose={close} onSave={(nextRisk) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: ['submitted', 'validated'].includes(item.reviewStatus) ? 'draft' : item.reviewStatus, risks: modal.risk ? item.risks.map((current) => current.id === nextRisk.id ? nextRisk : current) : [...(item.risks || []), nextRisk], history: [...item.history, historyEntry(`${modal.risk ? 'Risco atualizado' : 'Risco adicionado'}: ${nextRisk.title}.`, actor)] }), modal.risk ? 'Risco atualizado.' : 'Risco adicionado.'); close(); }} />}
    {modal?.type === 'measurement' && plan && <MeasurementForm plan={plan} item={modal.item} year={modal.period} onClose={close} onSave={(entry) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: 'draft', measurements: [...item.measurements, entry], history: [...item.history, historyEntry(`Resultado registrado para ${periodLabel(plan, item, entry.year)}: ${formatMetricValue(item, entry.value)}${item.metric.unit ? ` ${item.metric.unit}` : ''}. ${entry.note}`, actor)] }), 'Resultado registrado.'); close(); navigate(planUrl(plan.id, modal.item.id, 'indicadores', entry.year)); }} />}
    {modal?.type === 'targets' && plan && <TargetsForm plan={plan} item={modal.item} onClose={close} onSave={(targets) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: 'draft', metric: { ...item.metric, targets }, history: [...item.history, historyEntry('Metas atualizadas.', actor)] }), 'Metas salvas.'); close(); }} />}
    {modal?.type === 'review' && plan && <ReviewForm item={modal.item} decision={modal.decision} onClose={close} onSave={({ status, note }) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: status, reviewNote: note, history: [...item.history, historyEntry(status === 'validated' ? 'Informações validadas.' : `Correção solicitada: ${note}`, actor)] }), status === 'validated' ? 'Informações validadas.' : 'Correção solicitada.'); close(); }} />}
  </div>;
}

function Home({ data, session, can }) {
  const items = data.plans.flatMap((plan) => plan.items.map((item) => ({ plan, item })));
  const internalItems = items.filter(({ plan, item }) => can(PERMISSIONS.VIEW_INTERNAL_PLAN, resourceFor(plan, item)));
  const overdue = internalItems.reduce((total, { item }) => total + item.actions.flatMap((action) => action.tasks).filter((task) => taskOverdue(task)).length, 0);
  const awaiting = items.filter(({ plan, item }) => item.reviewStatus === 'submitted' && can(PERMISSIONS.REVIEW_ITEM, resourceFor(plan, item))).length;
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>{session.authenticated ? `Olá, ${session.user?.name?.split(' ')[0] || 'usuário'}` : 'Planejamento institucional'}</h1><p>{session.authenticated ? 'Acompanhe suas responsabilidades e os resultados dos planos institucionais.' : 'Consulte os planos e resultados publicados pela UFCG.'}</p></div></div>
    <div className="overview-grid"><article><span>Planejamentos disponíveis</span><strong>{data.plans.length}</strong><a href="#/planejamentos">Consultar planos <Icon name="arrow" size={14} /></a></article><article><span>Itens acompanhados</span><strong>{items.length}</strong><small>Iniciativas e metas</small></article>{session.authenticated && internalItems.length > 0 ? <article className={overdue ? 'has-overdue' : undefined}><span>Etapas atrasadas</span><strong>{overdue}</strong><small>Nos seus escopos de acesso</small></article> : <article><span>Planos publicados</span><strong>{data.plans.filter((plan) => plan.status === 'published').length}</strong><small>Consulta disponível</small></article>}{can(PERMISSIONS.VIEW_REVIEW_QUEUE) && <article><span>Aguardando validação</span><strong>{awaiting}</strong><a href="#/validacoes">Abrir fila <Icon name="arrow" size={14} /></a></article>}</div>
    <section className="home-section"><div className="section-heading"><div><h2>Planejamentos em acompanhamento</h2><p className="hint">Visão consolidada dos ciclos institucionais.</p></div><a className="text-button" href="#/planejamentos">Ver todos</a></div><div className="compact-plan-list">{data.plans.map((plan) => <a key={plan.id} href={`#${planUrl(plan.id)}`}><span className={`plan-icon ${plan.type.toLowerCase()}`}><Icon name={plan.type === 'PDI' ? 'book' : 'leaf'} size={18} /></span><span><strong>{plan.shortName}</strong><small>{plan.name}</small></span><span>{executionProgress({ actions: plan.items.flatMap((item) => item.actions) }).percent}%</span><Icon name="chevron" size={14} /></a>)}</div></section>
  </div>;
}

function WorkQueue({ plans, can }) {
  const rows = plans.flatMap((plan) => plan.items.filter((item) => can(PERMISSIONS.UPDATE_STAGE, resourceFor(plan, item)) || can(PERMISSIONS.RECORD_RESULT, resourceFor(plan, item))).map((item) => ({ plan, item })));
  return <QueuePage eyebrow="EXECUÇÃO" title="Minhas pendências" description="Itens sob sua responsabilidade de atualização." rows={rows} empty="Nenhuma pendência atribuída à sua sessão." />;
}

function ReviewQueue({ plans, can }) {
  const rows = plans.flatMap((plan) => plan.items.filter((item) => item.reviewStatus === 'submitted' && can(PERMISSIONS.REVIEW_ITEM, resourceFor(plan, item))).map((item) => ({ plan, item })));
  return <QueuePage eyebrow="VALIDAÇÃO" title="Validações" description="Informações enviadas para sua análise." rows={rows} empty="Não há informações aguardando validação." />;
}

function QueuePage({ eyebrow, title, description, rows, empty }) {
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></div>{rows.length ? <div className="queue-list">{rows.map(({ plan, item }) => <a key={`${plan.id}-${item.id}`} href={`#${planUrl(plan.id, item.id)}`}><span><Badge tone={plan.type === 'PDI' ? 'blue' : 'green'}>{plan.shortName}</Badge><strong>{item.code} · {item.title}</strong><small>{item.owner}</small></span><span><Badge tone={statusTone(reviewStatusLabel(item.reviewStatus))}>{reviewStatusLabel(item.reviewStatus)}</Badge><Icon name="chevron" size={14} /></span></a>)}</div> : <Empty title={empty}>Quando houver novos itens, eles aparecerão aqui.</Empty>}</div>;
}

function PlanList({ data, can, onCreate }) {
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const filtered = data.plans.filter((plan) => (filter === 'Todos' || plan.type === filter) && normalize(`${plan.shortName} ${plan.name}`).includes(normalize(search)));
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">PLANEJAMENTOS</p><h1>Planos institucionais</h1><p>Acompanhe estrutura, execução e resultados em um único lugar.</p></div>{can(PERMISSIONS.MANAGE_PLAN) && <Button icon="plus" variant="primary" onClick={onCreate}>Novo planejamento</Button>}</div>
    <div className="list-toolbar"><div className="segmented" aria-label="Filtrar tipo de planejamento">{['Todos', 'PDI', 'PLS'].map((value) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><label className="search"><Icon name="search" size={17} /><input aria-label="Buscar planejamento" placeholder="Buscar planejamento…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    {filtered.length ? <div className="plan-grid">{filtered.map((plan) => { const progress = executionProgress({ actions: plan.items.flatMap((item) => item.actions) }); return <article className={`plan-card ${plan.type.toLowerCase()}`} key={plan.id}><div className="plan-card-header"><div className="plan-identity"><span className="plan-icon"><Icon name={plan.type === 'PDI' ? 'book' : 'leaf'} size={22} /></span><div className="plan-card-title"><h2>{plan.shortName}</h2><span>{plan.start}–{plan.end}</span></div></div><Badge tone={plan.status === 'published' ? 'green' : 'neutral'}>{plan.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge></div><p className="plan-full-name">{plan.name}</p><div className="plan-card-progress"><Progress {...progress} /></div><div className="plan-card-footer"><div className="card-facts"><span>{plan.axes.length} eixos</span><span>{plan.items.length} {plan.template.labels.item.toLowerCase()}{plan.items.length !== 1 ? 's' : ''}</span></div><a className="open-plan" href={`#${planUrl(plan.id)}`} aria-label={`Abrir ${plan.shortName} ${plan.start}–${plan.end}`}>Abrir planejamento<Icon name="arrow" size={15} /></a></div></article>; })}</div> : <Empty title="Nenhum planejamento encontrado" action={<Button onClick={() => { setFilter('Todos'); setSearch(''); }}>Limpar filtros</Button>}>Tente outro nome ou tipo.</Empty>}
  </div>;
}

function Models({ templates, onEdit, onUse }) {
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Modelos de plano</h1><p>Defina a terminologia e os campos adicionais dos novos planejamentos.</p></div></div><div className="models-grid">{templates.map((template) => <article className="model-card" key={template.id}><div className="section-heading"><Badge tone={template.type === 'PDI' ? 'blue' : 'green'}>{template.type}</Badge><span className="muted text-sm">Versão {template.version}</span></div><h2>{template.name}</h2><p>{template.description}</p><div className="model-tree">{[template.labels.axis, template.labels.objective, template.labels.item, 'Ação', 'Etapa'].map((label, index) => <div key={label} style={{ marginLeft: index * 20 }}><Icon name={index === 4 ? 'check' : 'layers'} size={14} />{label}{index === 2 && <span>Indicador + metas</span>}</div>)}</div><div className="model-buttons"><Button icon="edit" onClick={() => onEdit(template)}>Editar modelo</Button><Button variant="primary" onClick={() => onUse(template)}>Criar plano<Icon name="arrow" size={15} /></Button></div></article>)}</div></div>;
}

function PlanPage({ plan, actor, can, route, onModal, changeItem }) {
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [collapsed, setCollapsed] = useState([]);
  const filtered = plan.items.filter((item) => { const axis = axisFor(plan, item); const objective = objectiveFor(plan, item); return normalize(`${item.code} ${item.title} ${axisLabel(axis)} ${objective?.title}`).includes(normalize(search)) && (!owner || item.owner === owner) && (!status || executionStatus(item) === status); });
  const item = filtered.find((candidate) => candidate.id === route.query.get('item')) || filtered[0];
  const selectedPeriod = Number(route.query.get('period'));
  const period = item && periods(plan, item).includes(selectedPeriod) ? selectedPeriod : currentPeriod(plan, item);
  const resource = resourceFor(plan, item);
  const tabs = [['acoes', 'list', 'Ações e etapas'], ['indicadores', 'chart', 'Indicador e metas'], ['riscos', 'info', `Riscos${item?.risks?.length ? ` (${item.risks.length})` : ''}`], ['historico', 'history', 'Histórico']].filter(([value]) => value !== 'riscos' || can(PERMISSIONS.VIEW_RISK, resource)).filter(([value]) => value !== 'historico' || can(PERMISSIONS.VIEW_HISTORY, resource));
  const tab = tabs.some(([value]) => value === route.query.get('tab')) ? route.query.get('tab') : 'acoes';
  const setPeriod = (next) => navigate(planUrl(plan.id, item.id, tab, next));
  const groups = plan.axes.filter((axis) => filtered.some((candidate) => candidate.axisId === axis.id));
  const toggle = (key) => setCollapsed((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const resetFilters = () => { setSearch(''); setOwner(''); setStatus(''); };
  return <div className="plan-page"><div className="plan-page-heading"><div><a className="back-link" href="#/planejamentos">← Todos os planejamentos</a><div className="title-line"><h1>{plan.shortName} <span>{plan.start}–{plan.end}</span></h1><Badge tone={plan.status === 'published' ? 'green' : 'neutral'}>{plan.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge></div><p>{plan.name}</p></div>{can(PERMISSIONS.MANAGE_PLAN, resourceFor(plan)) && <div className="heading-actions"><Button icon="layers" onClick={() => onModal({ type: 'structure' })}>Estrutura</Button>{plan.objectives.length > 0 && <Button variant="primary" icon="plus" onClick={() => onModal({ type: 'item' })}>Adicionar {plan.template.labels.item.toLowerCase()}</Button>}</div>}</div>
    <div className="explorer"><aside className="plan-tree" aria-label="Estrutura do plano"><div className="tree-heading"><h2>Estrutura do plano</h2><span>{plan.items.length} itens</span></div><label className="search"><Icon name="search" size={15} /><input aria-label="Buscar no plano" placeholder="Buscar no plano…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="tree-filters"><select aria-label="Filtrar responsável" value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Todos os responsáveis</option>{[...new Set(plan.items.map((candidate) => candidate.owner))].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filtrar situação" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas as situações</option>{['Não iniciada', 'Em andamento', 'Concluída', 'Cancelada'].map((value) => <option key={value}>{value}</option>)}</select></div>
      <nav aria-label="Itens do planejamento" className="tree-content">{groups.map((axis) => <div key={axis.id} className="axis-group" style={{ '--axis-color': axis.color }}><button className="tree-group axis" aria-expanded={!collapsed.includes(axis.id)} onClick={() => toggle(axis.id)}><Icon name="chevron" size={13} className={!collapsed.includes(axis.id) ? 'rotated' : ''} /><span>{axisLabel(axis)}</span></button>{!collapsed.includes(axis.id) && plan.objectives.filter((objective) => objective.axisId === axis.id && filtered.some((candidate) => candidate.objectiveId === objective.id)).map((objective) => <div className="objective-group" key={objective.id}><button className="tree-group objective" aria-expanded={!collapsed.includes(objective.id)} onClick={() => toggle(objective.id)}><Icon name="chevron" size={12} className={!collapsed.includes(objective.id) ? 'rotated' : ''} /><span>{objective.code} · {objective.title}</span></button>{!collapsed.includes(objective.id) && filtered.filter((candidate) => candidate.objectiveId === objective.id).map((candidate) => <a key={candidate.id} href={`#${planUrl(plan.id, candidate.id)}`} className={`tree-item ${item?.id === candidate.id ? 'selected' : ''}`} aria-current={item?.id === candidate.id ? 'page' : undefined} style={{ '--axis-color': axis.color }}><span className="node-dot" /><span><small>{plan.template.labels.item} {candidate.code}</small>{candidate.title}</span></a>)}</div>)}</div>)}{!filtered.length && <p className="tree-no-results">Nenhum item corresponde aos filtros.</p>}</nav></aside>
      <section className="detail" aria-label="Detalhe do item">{item ? <ItemDetail plan={plan} item={item} actor={actor} can={can} tab={tab} tabs={tabs} period={period} setPeriod={setPeriod} onModal={onModal} changeItem={changeItem} /> : <Empty title={plan.items.length ? 'Nenhum item encontrado' : 'Estrutura pronta para receber conteúdo'} action={plan.items.length ? <Button onClick={resetFilters}>Limpar filtros</Button> : can(PERMISSIONS.MANAGE_PLAN, resourceFor(plan)) ? <Button onClick={() => onModal({ type: 'structure' })}>Configurar estrutura</Button> : null}>{plan.items.length ? 'Ajuste os filtros para continuar.' : 'Cadastre os eixos e objetivos antes de incluir o primeiro item.'}</Empty>}</section></div></div>;
}

function ItemDetail({ plan, item, actor, can, tab, tabs, period, setPeriod, onModal, changeItem }) {
  const axis = axisFor(plan, item);
  const objective = objectiveFor(plan, item);
  const resource = resourceFor(plan, item);
  const canSeeWorkflow = can(PERMISSIONS.SUBMIT_ITEM, resource) || can(PERMISSIONS.REVIEW_ITEM, resource) || can(PERMISSIONS.VIEW_HISTORY, resource);
  const presentExtra = (field, value) => field.type === 'date' ? formatDate(value) : field.type === 'number' ? formatNumber(value) : value;
  const extraFields = plan.template.fields.filter((field) => item.extras?.[field.id] !== '' && item.extras?.[field.id] != null);
  const submit = () => changeItem(plan.id, item.id, (current) => ({ ...current, reviewStatus: 'submitted', reviewNote: '', history: [...current.history, historyEntry('Informações enviadas para validação.', actor)] }), 'Enviado para validação.');
  const selectTab = (nextTab) => navigate(planUrl(plan.id, item.id, nextTab, period));
  const moveTab = (event, index) => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - index - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const nextIndex = (index + keys[event.key] + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex][0]);
    requestAnimationFrame(() => document.querySelectorAll('.detail-tabs [role="tab"]')[nextIndex]?.focus());
  };
  return <><div className="item-heading" style={{ '--axis-color': axis?.color || '#2f78a5' }}><div className="section-heading"><div className="flex items-center gap-3"><span className="item-code">{plan.template.labels.item} {item.code}</span><Badge tone={statusTone(executionStatus(item))}>{executionStatus(item)}</Badge></div>{can(PERMISSIONS.EDIT_ITEM, resource) && <Button icon="edit" variant="ghost" onClick={() => onModal({ type: 'item', item })}>Editar informações</Button>}</div><h2>{item.title}</h2><p>{item.description}</p><div className="item-meta"><span><Icon name="layers" size={15} /><strong>{objective?.code} · {objective?.title}</strong></span><span><Icon name="user" size={15} /><strong>{item.owner}</strong></span>{item.partners && <span>Parceiros: {item.partners}</span>}</div>{extraFields.length > 0 && <div className="extra-values">{extraFields.map((field) => <span key={field.id}><b>{field.label}:</b> {presentExtra(field, item.extras[field.id])}</span>)}</div>}</div>
    {canSeeWorkflow && <div className={`workflow-banner ${item.reviewStatus}`}><div><span>Validação</span><strong>{reviewStatusLabel(item.reviewStatus)}</strong>{item.reviewNote && <p>{item.reviewNote}</p>}</div><div>{can(PERMISSIONS.SUBMIT_ITEM, resource) && ['draft', 'changes_requested'].includes(item.reviewStatus) && <Button variant="primary" onClick={submit}>Enviar para validação</Button>}{can(PERMISSIONS.REVIEW_ITEM, resource) && item.reviewStatus === 'submitted' && <><Button onClick={() => onModal({ type: 'review', item, decision: 'changes_requested' })}>Solicitar correção</Button><Button variant="primary" onClick={() => onModal({ type: 'review', item, decision: 'validated' })}>Validar</Button></>}</div></div>}
    {item.linkedPlan && <a className="linked-plan" href={`#${planUrl(item.linkedPlan)}`}><Icon name="link" size={16} /><span>Relacionado ao Plano Diretor de Logística Sustentável</span><Icon name="arrow" size={14} /></a>}
    <div className="detail-tabs" role="tablist">{tabs.map(([value, , label], index) => <button key={value} className={tab === value ? 'active' : ''} role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={(event) => moveTab(event, index)}>{label}</button>)}</div><div className="tab-content" role="tabpanel">
      {tab === 'acoes' && <Actions item={item} actor={actor} can={can} plan={plan} onAdd={() => onModal({ type: 'action', item })} onAddRisk={(action) => onModal({ type: 'risk', item, action })} onChange={(change, message) => changeItem(plan.id, item.id, (current) => ({ ...change(current), reviewStatus: ['submitted', 'validated'].includes(current.reviewStatus) ? 'draft' : current.reviewStatus }), message)} />}
      {tab === 'indicadores' && <Indicators key={item.id} item={item} can={can} plan={plan} period={period} setPeriod={setPeriod} onRecord={() => onModal({ type: 'measurement', item, period })} onTargets={() => onModal({ type: 'targets', item })} />}
      {tab === 'riscos' && <Risks item={item} canEdit={can(PERMISSIONS.MANAGE_RISK, resource)} onEdit={(risk) => onModal({ type: 'risk', item, action: item.actions.find((action) => action.id === risk.actionId), risk })} />}
      {tab === 'historico' && <History item={item} canComment={can(PERMISSIONS.COMMENT_HISTORY, resource)} onComment={(text) => changeItem(plan.id, item.id, (current) => ({ ...current, history: [...current.history, historyEntry(text, actor)] }), 'Observação adicionada.')} />}
    </div><footer className="source-note"><Icon name="info" size={13} />{item.source}</footer></>;
}

function StageRow({ task, action, actor, canUpdate, onChange }) {
  const [justifying, setJustifying] = useState(false);
  const [justification, setJustification] = useState(task.justification || '');
  const [error, setError] = useState('');
  const overdue = taskOverdue(task);
  const changeStatus = (status) => { onChange((current) => ({ ...current, actions: current.actions.map((candidate) => candidate.id === action.id ? { ...candidate, tasks: candidate.tasks.map((stage) => stage.id === task.id ? { ...stage, status } : stage) } : candidate), history: [...current.history, historyEntry(`Etapa “${task.title}” alterada para ${stageStatusLabel(status)}.`, actor)] }), 'Situação da etapa atualizada.'); if (status === 'cancelled' && !task.justification) setJustifying(true); };
  const saveJustification = (event) => { event.preventDefault(); if (!justification.trim()) return setError('Informe uma justificativa.'); onChange((current) => ({ ...current, actions: current.actions.map((candidate) => candidate.id === action.id ? { ...candidate, tasks: candidate.tasks.map((stage) => stage.id === task.id ? { ...stage, justification: justification.trim() } : stage) } : candidate), history: [...current.history, historyEntry(`Justificativa registrada para a etapa “${task.title}”.`, actor)] }), 'Justificativa salva.'); setJustifying(false); setError(''); };
  return <div className={`task-row ${task.status === 'completed' ? 'done' : ''} ${!canUpdate ? 'read-only' : ''} ${overdue ? 'overdue' : ''}`}>
    <div className="task-main"><span>{task.title}</span>{task.partners && <small>Parceiros: {task.partners}</small>}</div>
    <div className="task-deadline"><span className="mobile-field-label">Prazo</span><time dateTime={task.deadline}>{formatDate(task.deadline)}</time>{overdue && <span className="overdue-label">Atrasada</span>}</div>
    <div className="stage-control">
      {canUpdate ? <select className="stage-status-select" aria-label={`Situação de ${task.title}`} value={task.status} onChange={(event) => changeStatus(event.target.value)}>{Object.entries(stageStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <Badge tone={statusTone(stageStatusLabel(task.status))}>{stageStatusLabel(task.status)}</Badge>}
      {canUpdate && (overdue || task.status === 'cancelled' || task.justification) && <button type="button" className="justification-button" aria-expanded={justifying} onClick={() => setJustifying((current) => !current)}>{task.justification ? 'Justificativa' : 'Justificar'}</button>}
    </div>
    {justifying && canUpdate && <form className="justification-form" onSubmit={saveJustification}><label htmlFor={`justification-${task.id}`}>Justificativa da etapa</label><textarea id={`justification-${task.id}`} rows="2" maxLength={400} value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Informe a causa e, se possível, a nova previsão." />{error && <p role="alert" className="form-error">{error}</p>}<div><button type="submit" className="button primary">Salvar justificativa</button><button type="button" className="button" onClick={() => setJustifying(false)}>Cancelar</button></div></form>}
    {!justifying && task.justification && <p className="justification-text"><b>Justificativa:</b> {task.justification}</p>}
  </div>;
}

function Actions({ item, actor, can, plan, onAdd, onAddRisk, onChange }) {
  const [collapsed, setCollapsed] = useState([]);
  const [adding, setAdding] = useState(null);
  const [taskName, setTaskName] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPartners, setTaskPartners] = useState('');
  const [error, setError] = useState('');
  const progress = executionProgress(item);
  const resource = resourceFor(plan, item);
  const canManageAction = can(PERMISSIONS.MANAGE_ACTION, resource);
  const canUpdateStage = can(PERMISSIONS.UPDATE_STAGE, resource);
  const canManageRisk = can(PERMISSIONS.MANAGE_RISK, resource);
  const submitTask = (event, actionId) => { event.preventDefault(); if (!taskName.trim()) return setError('Informe o nome da etapa.'); if (!taskDeadline) return setError('Informe o prazo da etapa.'); onChange((current) => ({ ...current, actions: current.actions.map((action) => action.id === actionId ? { ...action, tasks: [...action.tasks, { id: uid(), title: taskName.trim(), status: 'not_started', deadline: taskDeadline, justification: '', partners: taskPartners.trim() }] } : action), history: [...current.history, historyEntry(`Etapa adicionada: ${taskName.trim()}.`, actor)] }), 'Etapa adicionada.'); setAdding(null); setTaskName(''); setTaskDeadline(''); setTaskPartners(''); setError(''); };
  const toggleAction = (actionId) => setCollapsed((current) => current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId]);
  const cancelStage = () => { setAdding(null); setTaskName(''); setTaskDeadline(''); setTaskPartners(''); setError(''); };
  return <>
    <div className="execution-summary" style={{ '--axis-color': axisFor(plan, item)?.color || '#2f78a5' }}>
      <span>Execução das etapas</span>
      <strong>{progress.total ? `${progress.percent}%` : '—'}</strong>
      <span className="execution-count">{progress.done} de {progress.total} etapas ativas concluídas</span>
      <div className="execution-bar" role="progressbar" aria-label="Execução das etapas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-valuetext={`${progress.done} de ${progress.total} etapas ativas concluídas`}><span style={{ width: `${progress.percent}%` }} /></div>
    </div>
    <div className="section-heading actions-heading">
      <h3>Ações estratégicas <span>{item.actions.length}</span></h3>
      {canManageAction && <Button icon="plus" onClick={onAdd}>Adicionar ação</Button>}
    </div>
    {!item.actions.length && <Empty title="Nenhuma ação cadastrada">Adicione uma ação para organizar sua execução.</Empty>}
    <div className="actions-list">
      {item.actions.map((action) => {
        const state = actionProgress(action);
        const closed = collapsed.includes(action.id);
        return <article className="action-card" key={action.id} style={{ '--axis-color': axisFor(plan, item)?.color || '#2f78a5' }}>
          <button className="action-heading" aria-expanded={!closed} onClick={() => toggleAction(action.id)}>
            <span className="action-name"><span className="action-number">{action.code}</span><span className="action-title">{action.title}</span><small>{action.owner} <span>·</span> Prazo: {formatDate(action.deadline)}</small></span>
            <span className="task-count"><span>{state.done} de {state.total} {state.total === 1 ? 'etapa concluída' : 'etapas concluídas'}</span><strong>{state.percent}%</strong></span>
            <Icon name="chevron" size={14} className={!closed ? 'rotated' : ''} />
          </button>
          {!closed && <div className="action-body">
            {action.tasks.length > 0 && <div className="stage-columns" aria-hidden="true"><span>Etapa</span><span>Prazo</span><span>Situação</span></div>}
            {action.tasks.map((task) => <StageRow key={task.id} task={task} action={action} actor={actor} canUpdate={canUpdateStage} onChange={onChange} />)}
            {!action.tasks.length && <p className="hint px-5 pt-3">Esta ação ainda não possui etapas.</p>}
            {adding === action.id ? <form className="inline-task-form" onSubmit={(event) => submitTask(event, action.id)}>
              <input aria-label="Nome da etapa" autoFocus required maxLength={180} placeholder="Descreva a etapa…" value={taskName} onChange={(event) => setTaskName(event.target.value)} />
              <input aria-label="Prazo da etapa" type="date" min={`${plan.start}-01-01`} max={`${plan.end}-12-31`} required value={taskDeadline} onChange={(event) => setTaskDeadline(event.target.value)} />
              <input aria-label="Parceiros da etapa" maxLength={150} placeholder="Parceiros (opcional)" value={taskPartners} onChange={(event) => setTaskPartners(event.target.value)} />
              <Button type="submit" variant="primary">Adicionar</Button>
              <Button onClick={cancelStage}>Cancelar</Button>
              {error && <p role="alert" className="form-error">{error}</p>}
            </form> : (canManageAction || canManageRisk) && <div className="action-tools">
              {canManageAction && <button className="add-task" onClick={() => setAdding(action.id)}><Icon name="plus" size={14} />Adicionar etapa<span className="sr-only"> em {action.title}</span></button>}
              {canManageRisk && <button className="add-risk" onClick={() => onAddRisk(action)}><Icon name="info" size={14} />Adicionar risco<span className="sr-only"> em {action.title}</span></button>}
            </div>}
          </div>}
        </article>;
      })}
    </div>
  </>;
}

function Indicators({ item, can, plan, period, setPeriod, onRecord, onTargets }) {
  const [view, setView] = useState('table');
  const result = metricResult(item, period);
  const target = item.metric.targets[period];
  const status = metricStatus(item, period);
  const achievement = metricAchievement(item, period);
  const resource = resourceFor(plan, item);
  const canRecord = item.metric.measurementMode !== 'stages' && can(PERMISSIONS.RECORD_RESULT, resource);
  const descriptive = item.metric.valueType === 'status';
  const list = periods(plan, item);
  const hasEvolution = list.length > 1 && !descriptive;
  const measurements = [...item.measurements].reverse().filter((entry) => Number(entry.year) === Number(period));
  const description = item.metric.measurementMode === 'stages' ? 'Calculado automaticamente pela conclusão das etapas ativas.' : item.metric.measurementMode === 'delivery' ? 'Entrega acompanhada por situação e evidências.' : `Valor informado · ${item.metric.direction === 'down' ? 'Quanto menor, melhor' : 'Quanto maior, melhor'} · ${item.metric.periodicity === 'annual' ? 'Consolidado anual' : 'Resultado do ciclo'}`;
  const metricValue = (value) => `${formatMetricValue(item, value)}${value == null || value === '' || !item.metric.unit ? '' : ` ${item.metric.unit}`}`;
  const targetValue = (value) => `${value != null && value !== '' && item.metric.direction === 'down' ? '≤ ' : ''}${metricValue(value)}`;
  return <section className="indicator" aria-label="Indicador e metas" style={{ '--axis-color': axisFor(plan, item)?.color || '#2f78a5' }}>
    <div className="section-heading indicator-heading">
      <div><h3>{item.metric.name}</h3><p>{description}</p></div>
      <Field label={item.metric.periodicity === 'final' ? 'Período' : 'Ano de referência'} className="year-field"><select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>{list.map((value) => <option key={value} value={value}>{periodLabel(plan, item, value)}</option>)}</select></Field>
    </div>
    <div className={`indicator-summary ${status === 'Meta atingida' ? 'green' : status === 'Meta não atingida' ? 'critical' : status === 'Em acompanhamento' ? 'blue' : 'neutral'} ${descriptive ? 'descriptive' : ''}`}>
      <div className="current-result"><span>Resultado</span><strong>{metricValue(result)}</strong><Badge tone={metricTone(item, period)}>{status}</Badge></div>
      <div><span>Meta</span><strong>{targetValue(target)}</strong></div>
      {!descriptive && <div><span>Atingimento</span><strong>{achievement == null ? '—' : `${achievement}%`}</strong></div>}
    </div>
    <div className="indicator-reference"><p><b>Linha de base:</b> {metricValue(item.metric.baseline)}{item.metric.reference && <span> · {item.metric.reference}</span>}</p><p className="formula"><b>{descriptive ? 'Critério:' : 'Cálculo:'}</b> {item.metric.formula}</p></div>
    <div className="section-heading annual-heading">
      <h3>{item.metric.periodicity === 'final' ? 'Meta e resultado do ciclo' : 'Metas e resultados por ano'}</h3>
      <div className="annual-tools">
        {hasEvolution && <div className="view-switch" role="group" aria-label="Visualização dos resultados"><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Tabela</button><button type="button" aria-pressed={view === 'evolution'} onClick={() => setView('evolution')}>Evolução</button></div>}
        {can(PERMISSIONS.EDIT_TARGET, resource) && <Button variant="ghost" onClick={onTargets}>Editar metas</Button>}
      </div>
    </div>
    {view === 'table' || !hasEvolution ? <div className="table-scroll"><table className={`annual-table ${descriptive ? 'descriptive' : ''}`}>
      <thead><tr><th scope="col">Período</th><th scope="col">Meta{item.metric.unit && ` (${item.metric.unit})`}</th><th scope="col">Resultado{item.metric.unit && ` (${item.metric.unit})`}</th>{!descriptive && <th scope="col">Atingimento</th>}<th scope="col">Situação</th></tr></thead>
      <tbody>{list.map((value) => {
        const annualAchievement = metricAchievement(item, value);
        return <tr key={value} className={period === value ? 'current-year' : ''}>
          <th scope="row"><button type="button" className="period-button" aria-label={`Selecionar ${periodLabel(plan, item, value)}`} aria-pressed={period === value} onClick={() => setPeriod(value)}>{periodLabel(plan, item, value)}</button></th>
          <td>{item.metric.targets[value] != null && item.metric.targets[value] !== '' && item.metric.direction === 'down' ? '≤ ' : ''}{formatMetricValue(item, item.metric.targets[value])}</td>
          <td>{formatMetricValue(item, metricResult(item, value))}</td>
          {!descriptive && <td>{annualAchievement == null ? '—' : `${annualAchievement}%`}</td>}
          <td><Badge tone={metricTone(item, value)}>{metricStatus(item, value)}</Badge></td>
        </tr>;
      })}</tbody>
    </table></div> : <IndicatorEvolution item={item} plan={plan} period={period} setPeriod={setPeriod} />}
    <div className="record-footer"><p>{latestMeasurement(item, period) ? `Último registro: ${formatDate(latestMeasurement(item, period).at)}` : item.metric.measurementMode === 'stages' ? 'Resultado atualizado automaticamente pelas etapas.' : 'Nenhum resultado registrado para o período.'}</p>{canRecord && <Button variant="primary" icon="plus" onClick={onRecord}>Registrar resultado</Button>}</div>
    <div className="measurements"><h3>Registros do período</h3>{measurements.length ? measurements.map((entry) => <article className="measurement" key={entry.id}><div><strong>{metricValue(entry.value)}</strong><time>{formatDate(entry.at)}</time></div><p>{entry.note}</p>{entry.evidence && <a href={entry.evidence} target="_blank" rel="noreferrer">Abrir evidência <Icon name="arrow" size={13} /></a>}</article>) : <p className="hint">Nenhum registro manual para este período.</p>}</div>
  </section>;
}

function IndicatorEvolution({ item, plan, period, setPeriod }) {
  return <div className="indicator-evolution" role="region" aria-label="Evolução anual do atingimento">
    <p className="hint">Atingimento da meta por ano. 100% corresponde à meta atingida.</p>
    <div className="evolution-scale" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
    {periods(plan, item).map((value) => {
      const achievement = metricAchievement(item, value);
      return <button type="button" key={value} className="evolution-row" aria-pressed={period === value} aria-label={`Selecionar ${value}: ${achievement == null ? metricStatus(item, value) : `${achievement}% de atingimento`}`} onClick={() => setPeriod(value)}>
        <span className="evolution-year">{value}</span>
        {achievement == null ? <span className="evolution-empty">{metricStatus(item, value)}</span> : <><span className="evolution-track" aria-hidden="true"><span style={{ width: `${achievement}%` }} /></span><strong>{achievement}%</strong></>}
      </button>;
    })}
  </div>;
}

function Risks({ item, canEdit, onEdit }) {
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const risks = item.risks || [];
  const probabilities = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];
  const selectedRisks = selected?.mode === 'cell'
    ? risks.filter((entry) => entry.probability === selected.probability && entry.impact === selected.impact)
    : selected?.mode === 'level'
      ? risks.filter((entry) => riskLevel(entry.probability, entry.impact) === selected.level)
      : risks;
  const selectLevel = (level) => setSelected((current) => current?.mode === 'level' && current.level === level ? null : { mode: 'level', level });
  return (
    <div className="risk-panel">
      <div className="section-heading">
        <div>
          <h3>Riscos associados à execução</h3>
          <p className="hint">Riscos vinculados às ações e etapas deste item.</p>
        </div>
        <Badge>{risks.length} registros</Badge>
      </div>
      <div className="risk-legend">
        {['low', 'moderate', 'high', 'critical'].map((level) => <button key={level} className="risk-filter-button" aria-pressed={selected?.mode === 'level' && selected.level === level} onClick={() => selectLevel(level)}><i className={`risk-dot ${level}`} />{riskLevelLabel(level)} <small>{risks.filter((entry) => riskLevel(entry.probability, entry.impact) === level).length}</small></button>)}
      </div>
      <div className="risk-matrix-wrap">
        <div className="risk-axis-label vertical">PROBABILIDADE</div>
        <div className="risk-matrix">
          <div className="risk-corner"><span>IMPACTO</span></div>
          <div className="risk-impact-head">{impacts.map((impact) => <span key={impact}>{impact}</span>)}</div>
          {probabilities.map((probability) => <React.Fragment key={probability}>
            <span className="risk-probability">{probability}</span>
            {impacts.map((impact) => {
              const level = riskLevel(probability, impact);
              const count = risks.filter((entry) => entry.probability === probability && entry.impact === impact).length;
              const active = selected?.mode === 'cell' && selected.probability === probability && selected.impact === impact;
              return <button key={`${probability}-${impact}`} className={`risk-cell ${level} ${active ? 'selected' : ''}`} aria-label={`Probabilidade ${probability}, impacto ${impact}: ${riskLevelLabel(level)}${count ? `, ${count} risco${count > 1 ? 's' : ''}` : ''}`} aria-pressed={active} onClick={() => setSelected(active ? null : { mode: 'cell', probability, impact, level })}><b>{riskLevelLabel(level)}</b>{count > 0 && <small>{count}</small>}</button>;
            })}
          </React.Fragment>)}
        </div>
      </div>
      <p className="risk-matrix-caption">Selecione uma célula ou classificação para filtrar os riscos.</p>
      {selected && <div className="risk-filter"><strong>{selected.mode === 'cell' ? `P${selected.probability} × I${selected.impact}` : riskLevelLabel(selected.level)}</strong><span>{selected.mode === 'cell' ? riskLevelLabel(selected.level) : 'Todos os riscos desta classificação'}</span><button className="text-button" onClick={() => setSelected(null)}>Mostrar todos</button></div>}
      <div className="risk-list">
        {selectedRisks.length ? selectedRisks.map((entry) => (
          <article className="risk-card" key={entry.id}>
            <div className={`risk-card-level ${riskLevel(entry.probability, entry.impact)}`}>
              <strong>{riskLevelLabel(riskLevel(entry.probability, entry.impact))}</strong>
              <span>RI {riskScore(entry.probability, entry.impact)} · RR {formatNumber(residualRisk(entry.probability, entry.impact, entry.maturity))}</span>
            </div>
            <div className="risk-card-body">
              <div className="risk-card-title">
                <h4>{entry.title}</h4>
                <div><button className="text-button" onClick={() => setDetails((current) => current === entry.id ? null : entry.id)}>{details === entry.id ? 'Ocultar detalhes' : 'Detalhar'}</button>{canEdit && <button className="text-button" onClick={() => onEdit(entry)}>Editar</button>}</div>
              </div>
              <p><b>Ação:</b> {item.actions.find((action) => action.id === entry.actionId)?.title || entry.actionId} · <b>Etapa:</b> {entry.stage || 'Não especificada'}</p>
              <p><b>Categoria:</b> {entry.category} · <b>Resposta:</b> {entry.response}</p>
              {details === entry.id && <div className="risk-extra-details"><p><b>Risco estratégico:</b> {entry.strategicRisk}</p><p><b>Causa:</b> {entry.cause}</p><p><b>Consequência:</b> {entry.consequence}</p><p><b>Controle:</b> {entry.controls} · {entry.controlType} · {entry.maturity} (FC {controlFactor(entry.maturity)})</p><p><b>Tratamento:</b> {entry.treatment}</p><div className="risk-card-meta"><span>Responsável: <b>{entry.treatmentOwner}</b></span><span>Execução: <b>{entry.execution}%</b></span><span>Revisão: <b>{entry.review}</b></span><span>Status: <b>{entry.status}</b></span></div></div>}
            </div>
          </article>
        )) : (
          <Empty title={risks.length ? 'Nenhum risco nesta classificação' : 'Nenhum risco cadastrado'}>{risks.length ? 'Selecione outra célula ou classificação.' : 'Os riscos vinculados às etapas aparecerão aqui.'}</Empty>
        )}
      </div>
    </div>
  );
}

function History({ item, canComment, onComment }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const submit = (event) => { event.preventDefault(); if (!comment.trim()) return setError('Escreva uma observação.'); onComment(comment.trim()); setComment(''); setError(''); };
  return <><div className="section-heading"><div><h3>Histórico do acompanhamento</h3><p className="hint">Atualizações, resultados, validações e observações.</p></div><Badge>{item.history.length} registros</Badge></div>{canComment && <form className="comment-form" onSubmit={submit}><Field label="Adicionar observação"><textarea rows="2" required maxLength={400} placeholder="Registre um contexto ou encaminhamento…" value={comment} onChange={(event) => setComment(event.target.value)} /></Field>{error && <p role="alert" className="form-error">{error}</p>}<Button type="submit">Salvar observação</Button></form>}<div className="timeline">{[...item.history].reverse().map((entry) => <article key={entry.id}><span className="timeline-dot" /><div className="timeline-meta"><strong>{entry.actor}</strong><time>{formatDate(entry.at)}</time></div><p>{entry.text}</p></article>)}</div></>;
}

createRoot(document.getElementById('root')).render(<SessionProvider><AppGate /></SessionProvider>);
