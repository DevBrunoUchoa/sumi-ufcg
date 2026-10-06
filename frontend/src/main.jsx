import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { actionProgress, axisFor, axisLabel, controlFactor, currentPeriod, executionProgress, executionStatus, formatDate, formatMetricValue, formatNumber, historyEntry, latestMeasurement, metricAchievement, metricResult, metricStatus, metricTone, normalize, objectiveFor, periodLabel, periods, residualRisk, reviewStatusLabel, riskLevel, riskLevelLabel, riskScore, stageStatusLabel, stageStatusLabels, taskOverdue, uid } from './domain.js';
import { Badge, Button, Empty, Field, Icon, Input, Modal, Select } from './ui.jsx';
import { ActionForm, ItemForm, MeasurementForm, PlanForm, ReviewForm, RiskForm, StageForm, StructureForm, TargetsForm, TemplateForm } from './forms.jsx';
import { SessionProvider, useSession } from './auth/context.jsx';
import { PERMISSIONS, resourceFor } from './auth/permissions.js';
import { LoginPage } from './auth/Login.jsx';
import { ForbiddenPage, NotFoundPage, OfflinePage, ServerErrorPage, UnauthorizedPage } from './error-pages.jsx';
import { Attachments, AttachmentsProvider } from './attachments.jsx';
import { UsersAdmin } from './UsersAdmin.jsx';
import { createPlanningClient } from './planning-client.js';
import { baixarModeloPlanilha, importarPlanilha } from './importacao-client.js';
import { AxisIcon } from './AxisIcon.jsx';
import { PdiWorkspace } from './planning/PdiWorkspace.jsx';
import { itemUrl, planUrl, resolvePlanRoute } from './planning/navigation.js';
import '@govbr-ds/core/dist/core.css';
import './styles.css';
import './planning/planning.css';
import { AppShell } from './layout/AppShell.jsx';
import { PublicHome, InformationPage } from './layout/PublicPages.jsx';
import { loginUrl, safeReturnPath } from './auth/navigation.js';
import './layout/layout.css';
import './layout/theme.css';

const KNOWN_TOP_LEVEL_PATHS = ['/inicio', '/planejamentos', '/pendencias', '/validacoes', '/modelos', '/usuarios', '/login', '/sobre', '/ajuda', '/privacidade'];
const EMPTY_WORKSPACE = { version: 2, templates: [], plans: [] };
const PUBLIC_SESSION = { authenticated: false, user: null, roles: [], grants: [] };
const isOfflineError = (error) => error instanceof TypeError || error?.name === 'AbortError';

const PAGE_DESCRIPTIONS = {
  '/inicio': 'Consulta aos planos publicados e acompanhamento dos resultados institucionais.',
  '/planejamentos': 'Planos institucionais com estrutura, execução e indicadores.',
  '/pendencias': 'Itens sob sua responsabilidade de atualização nos planos institucionais.',
  '/validacoes': 'Fila de informações enviadas para validação nos planos institucionais.',
  '/modelos': 'Modelos de plano institucional — estrutura e campos adicionais.',
  '/usuarios': 'Gerenciamento de usuários e permissões do SUMI.',
  '/login': 'Acesso à área de trabalho do Sistema Unificado de Monitoramento Institucional.',
  '/sobre': 'Conheça o SUMI e a consulta pública aos planos institucionais.',
  '/ajuda': 'Orientações de navegação, acesso e acessibilidade do SUMI.',
  '/privacidade': 'Informações sobre sessão e preferências armazenadas pelo SUMI.',
};
const DEFAULT_DESCRIPTION = 'SUMI — Sistema Unificado de Monitoramento Institucional.';

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
  const response = await fetch(`${authApiBase}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
}

const planningClient = createPlanningClient();
const ALTO_CONTRASTE_KEY = 'sumi.ui.alto-contraste';
const DARK_MODE_KEY = 'sumi.ui.dark-mode';
const VLIBRAS_KEY = 'sumi.ui.vlibras';
const navigate = (path) => { window.location.hash = path; };
const readRoute = () => { const [path, query] = (window.location.hash.slice(1) || '/inicio').split('?'); return { path, query: new URLSearchParams(query) }; };
const statusTone = (status) => status === 'Concluída' || status === 'Meta atingida' || status === 'Validado' ? 'green' : status === 'Em andamento' || status === 'Aguardando validação' ? 'blue' : status === 'Correção solicitada' ? 'attention' : 'neutral';
const readAltoContrastePreference = () => { try { return localStorage.getItem(ALTO_CONTRASTE_KEY) === 'true'; } catch { return false; } };
const readDarkModePreference = () => { try { return !readAltoContrastePreference() && localStorage.getItem(DARK_MODE_KEY) === 'true'; } catch { return false; } };
// VLibras vem sempre ligado no HTML (index.html) — a preferência só existe
// pra permitir desligar; sem valor salvo, assume ligado (comportamento atual).
const readVlibrasPreference = () => { try { return localStorage.getItem(VLIBRAS_KEY) !== 'false'; } catch { return true; } };

function Progress({ done, total, percent, label = 'etapas', compact = false }) {
  const value = percent ?? (total ? done / total * 100 : 0);
  return <div className={`progress-block ${compact ? 'compact' : ''}`}><div className="progress-track" role="progressbar" aria-label={`Execução das ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><span style={{ width: `${value}%` }} /></div><span>{Math.round(value)}% {label}</span></div>;
}

function AppGate() {
  const auth = useSession();
  return <App auth={auth} />;
}

function App({ auth }) {
  const session = auth.session || PUBLIC_SESSION;
  const { can } = auth;
  const [data, setData] = useState(EMPTY_WORKSPACE);
  const savedData = useRef(EMPTY_WORKSPACE);
  const saveTimer = useRef(null);
  const activeSave = useRef(Promise.resolve());
  const workspaceRequest = useRef(null);
  const [workspaceState, setWorkspaceState] = useState({ status: 'loading', error: null });
  const [route, setRoute] = useState(readRoute);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [saveError, setSaveError] = useState('');
  const needsWorkspace = !['/login', '/sobre', '/ajuda', '/privacidade'].includes(route.path);
  const sessionKey = session.authenticated ? session.user.id : 'public';
  const replaceData = (next) => { savedData.current = next; setData(next); };
  const loadWorkspace = () => {
    workspaceRequest.current?.abort();
    const controller = new AbortController();
    workspaceRequest.current = controller;
    setWorkspaceState({ status: 'loading', error: null, sessionKey });
    planningClient.load({ signal: controller.signal }).then((next) => {
      if (controller.signal.aborted) return;
      savedData.current = next; setData(next); setWorkspaceState({ status: 'ready', error: null, sessionKey });
    }).catch((error) => { if (!controller.signal.aborted) setWorkspaceState({ status: 'error', error, sessionKey }); });
    return () => controller.abort();
  };
  useEffect(() => {
    if (!needsWorkspace || auth.status !== 'ready') return;
    loadWorkspace();
    return () => workspaceRequest.current?.abort();
  }, [sessionKey, needsWorkspace, auth.status]);
  const [altoContraste, setAltoContraste] = useState(readAltoContrastePreference);
  const [darkMode, setDarkMode] = useState(readDarkModePreference);
  const [vlibrasAtivo, setVlibrasAtivo] = useState(readVlibrasPreference);
  useEffect(() => { const changed = () => { setRoute(readRoute()); setModal(null); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  useEffect(() => {
    if (altoContraste) document.documentElement.setAttribute('data-alto-contraste', 'true');
    else document.documentElement.removeAttribute('data-alto-contraste');
  }, [altoContraste]);
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    document.documentElement.style.removeProperty('background-color');
    document.documentElement.style.removeProperty('color-scheme');
  }, [darkMode]);
  useEffect(() => {
    // O widget é injetado pelo script do index.html (fora da árvore React) —
    // desligar aqui só esconde o container, sem reinicializar o plugin.
    const container = document.querySelector('div[vw]');
    if (container) container.style.display = vlibrasAtivo ? '' : 'none';
  }, [vlibrasAtivo]);
  useEffect(() => {
    if (data === savedData.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      activeSave.current = planningClient.save(data).then(() => { savedData.current = data; setSaveError(''); }).catch((error) => { setSaveError('Não foi possível salvar as alterações.'); throw error; });
      activeSave.current.catch(() => {});
    }, 150);
    return () => clearTimeout(saveTimer.current);
  }, [data]);
  const leaveSession = async () => {
    clearTimeout(saveTimer.current);
    await activeSave.current.catch(() => {});
    if (data !== savedData.current) { await planningClient.save(data); savedData.current = data; }
    await logout();
    replaceData(EMPTY_WORKSPACE);
    setWorkspaceState({ status: 'loading', error: null });
    await auth.reload();
    navigate('/inicio');
  };
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  const update = (mutate, message) => { setData((current) => { const next = structuredClone(current); mutate(next); return next; }); if (message) setToast(message); };
  const importPlanilha = async (planId, arquivo) => {
    try {
      const resumo = await importarPlanilha(planId, arquivo);
      const fresh = await planningClient.load();
      replaceData(fresh);
      setToast(`Planilha importada: ${resumo.itensCriados} iniciativa${resumo.itensCriados === 1 ? '' : 's'} nova${resumo.itensCriados === 1 ? '' : 's'}, ${resumo.itensAtualizados} atualizada${resumo.itensAtualizados === 1 ? '' : 's'}, ${resumo.riscosImportados} risco${resumo.riscosImportados === 1 ? '' : 's'}.`);
      return resumo;
    } catch (err) {
      // Um timeout de proxy (502/503/504) não significa que o servidor não terminou —
      // em planilhas grandes o processamento pode passar do limite do proxy mesmo tendo
      // sucesso no backend. Recarrega o workspace para refletir o estado real antes de
      // repassar o erro, para não deixar a árvore desatualizada nem convidar um reenvio
      // duplicado enquanto a importação anterior ainda pode estar concluindo.
      const fresh = await planningClient.load().catch(() => null);
      if (fresh) replaceData(fresh);
      throw err;
    }
  };
  const changeItem = (planId, itemId, change, message) => update((draft) => { const plan = draft.plans.find((candidate) => candidate.id === planId); const index = plan.items.findIndex((item) => item.id === itemId); plan.items[index] = change(plan.items[index]); }, message);
  const close = () => setModal(null);
  const toggleAltoContraste = () => {
    const next = !altoContraste;
    setAltoContraste(next);
    if (next) setDarkMode(false);
    try { localStorage.setItem(ALTO_CONTRASTE_KEY, String(next)); if (next) localStorage.setItem(DARK_MODE_KEY, 'false'); } catch { /* armazenamento indisponível */ }
  };
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) setAltoContraste(false);
    try { localStorage.setItem(DARK_MODE_KEY, String(next)); if (next) localStorage.setItem(ALTO_CONTRASTE_KEY, 'false'); } catch { /* armazenamento indisponível */ }
  };
  const toggleVlibras = () => setVlibrasAtivo((current) => { const next = !current; try { localStorage.setItem(VLIBRAS_KEY, String(next)); } catch { /* armazenamento indisponível */ } return next; });
  const encodedPlanId = route.path.startsWith('/plano/') ? route.path.split('/')[2] : null;
  let planId;
  try { planId = encodedPlanId ? decodeURIComponent(encodedPlanId) : null; } catch { planId = null; }
  const visiblePlans = data.plans.filter((plan) => can(PERMISSIONS.VIEW_INTERNAL_PLAN, resourceFor(plan)) || (plan.status === 'published' && can(PERMISSIONS.VIEW_PUBLISHED_PLAN, resourceFor(plan))));
  const plan = visiblePlans.find((candidate) => candidate.id === planId);
  const planningContext = plan?.type === 'PDI' ? resolvePlanRoute(plan, route) : null;
  const actor = session.user?.name || session.user?.email || 'Usuário do sistema';
  useEffect(() => {
    const label = planningContext?.item ? `${planningContext.stage?.title || planningContext.action?.title || planningContext.item.title} · ${plan.shortName}` : planningContext?.axis ? `${planningContext.axis.name} · ${plan.shortName}` : plan?.shortName || ({ '/inicio': 'Início', '/planejamentos': 'Planejamentos', '/pendencias': 'Minhas pendências', '/validacoes': 'Validações', '/modelos': 'Modelos', '/usuarios': 'Usuários', '/login': 'Entrar', '/sobre': 'Sobre o SUMI', '/ajuda': 'Ajuda', '/privacidade': 'Privacidade' })[route.path] || 'SUMI';
    document.title = `SUMI · ${label}`;
    setMetaDescription((plan && `${plan.name} — acompanhamento de eixos, iniciativas, indicadores e execução no SUMI.`) || PAGE_DESCRIPTIONS[route.path] || DEFAULT_DESCRIPTION);
  }, [plan?.shortName, plan?.name, planningContext?.axis?.name, planningContext?.item?.title, planningContext?.action?.title, planningContext?.stage?.title, route.path]);

  function saveItem(nextItem, id) {
    update((draft) => { const currentPlan = draft.plans.find((candidate) => candidate.id === id); const index = currentPlan.items.findIndex((item) => item.id === nextItem.id); if (index < 0) currentPlan.items.push(nextItem); else currentPlan.items[index] = { ...nextItem, reviewStatus: ['submitted', 'validated'].includes(currentPlan.items[index].reviewStatus) ? 'draft' : nextItem.reviewStatus }; }, 'Informações salvas.');
    close(); navigate(itemUrl(data.plans.find((candidate) => candidate.id === id), nextItem));
  }

  const links = [{ path: '/inicio', icon: 'grid', text: 'Visão geral' }, { path: '/planejamentos', icon: 'book', text: 'Planos' }];
  if (can(PERMISSIONS.VIEW_WORK_QUEUE)) links.push({ path: '/pendencias', icon: 'list', text: 'Minhas pendências' });
  if (can(PERMISSIONS.VIEW_REVIEW_QUEUE)) links.push({ path: '/validacoes', icon: 'check', text: 'Validações' });
  if (can(PERMISSIONS.MANAGE_MODEL)) links.push({ path: '/modelos', icon: 'layers', text: 'Modelos de plano' }, { path: '/usuarios', icon: 'user', text: 'Usuários' });
  const loading = needsWorkspace && auth.status !== 'error' && (auth.status === 'loading' || workspaceState.status === 'loading' || workspaceState.sessionKey !== sessionKey);
  return <AppShell route={route} plan={plan} session={session} mode={route.path === '/login' ? 'access' : session.authenticated ? 'work' : 'public'} links={links} altoContraste={altoContraste} darkMode={darkMode} vlibrasAtivo={vlibrasAtivo} toggleAltoContraste={toggleAltoContraste} toggleDarkMode={toggleDarkMode} toggleVlibras={toggleVlibras} onLogout={leaveSession} loading={loading}>
      {saveError && <div role="alert" className="warning-strip">{saveError}</div>}
        {route.path === '/login' ? <LoginPage authenticated={session.authenticated} returnTo={safeReturnPath(route.query.get('returnTo'))} onSuccess={async () => { await auth.reload(); navigate(safeReturnPath(route.query.get('returnTo'))); }} />
          : ['/sobre', '/ajuda', '/privacidade'].includes(route.path) ? <InformationPage path={route.path} />
          : loading ? <div className="sumi-loading" role="status"><div className="br-loading medium" aria-hidden="true" /><p>Carregando os planos…</p></div>
          : auth.status === 'error' ? (isOfflineError(auth.error) ? <OfflinePage onRetry={() => auth.reload().catch(() => {})} /> : <ServerErrorPage onRetry={() => auth.reload().catch(() => {})} />)
          : workspaceState.status === 'error' ? (isOfflineError(workspaceState.error) ? <OfflinePage onRetry={loadWorkspace} /> : <ServerErrorPage onRetry={loadWorkspace} />)
          : route.path === '/inicio' ? <Home data={{ ...data, plans: visiblePlans }} session={session} can={can} />
          : route.path === '/planejamentos' ? <PlanList data={{ ...data, plans: visiblePlans }} can={can} onCreate={() => setModal({ type: 'plan' })} />
            : route.path === '/pendencias' && can(PERMISSIONS.VIEW_WORK_QUEUE) ? <WorkQueue plans={visiblePlans} can={can} />
              : route.path === '/validacoes' && can(PERMISSIONS.VIEW_REVIEW_QUEUE) ? <ReviewQueue plans={visiblePlans} can={can} />
                : route.path === '/modelos' && can(PERMISSIONS.MANAGE_MODEL) ? <Models templates={data.templates} onEdit={(template) => setModal({ type: 'template', template })} onUse={(template) => setModal({ type: 'plan', templateId: template.id })} />
                  : route.path === '/usuarios' && can(PERMISSIONS.MANAGE_MODEL) ? <UsersAdmin currentUserId={session.user?.id} />
                    : plan ? <PlanPage key={plan.id} plan={plan} actor={actor} can={can} authenticated={session.authenticated} route={route} onModal={setModal} changeItem={changeItem} onImportPlanilha={importPlanilha} />
                    // /plano/:id sem correspondência não distingue "não existe" de "existe mas sem acesso" —
                    // o backend já nem devolve planos sem acesso, então tratar como 404 evita confirmar a
                    // existência de um plano para quem não pode vê-lo. Itens de navegação conhecidos
                    // (pendências/validações/modelos) têm a existência pública; só o acesso é negado, daí 401/403.
                    : KNOWN_TOP_LEVEL_PATHS.includes(route.path)
                      ? (session.authenticated ? <ForbiddenPage onGoHome={() => navigate('/inicio')} /> : <UnauthorizedPage onLogin={() => navigate(loginUrl(route))} />)
                      : <NotFoundPage onGoHome={() => navigate('/inicio')} />}
    {toast && <div role="status" className="toast"><Icon name="check" size={17} />{toast}</div>}
    {modal?.type === 'plan' && <PlanForm templates={data.templates} initialTemplate={modal.templateId} onClose={close} onSave={(newPlan) => { update((draft) => draft.plans.push(newPlan), 'Planejamento criado.'); close(); navigate(planUrl(newPlan.id)); }} />}
    {modal?.type === 'template' && <TemplateForm template={modal.template} onClose={close} onSave={(template) => { update((draft) => { draft.templates = draft.templates.map((current) => current.id === template.id ? template : current); }, 'Modelo salvo.'); close(); }} />}
    {modal?.type === 'structure' && <StructureForm plan={plan} onClose={close} onSave={(structure) => { update((draft) => { const current = draft.plans.find((candidate) => candidate.id === plan.id); current.axes = structure.axes; current.objectives = structure.objectives; }, 'Estrutura atualizada.'); close(); }} />}
    {modal?.type === 'item' && plan && <ItemForm plan={plan} item={modal.item} initialAxisId={modal.axisId} initialObjectiveId={modal.objectiveId} actor={actor} onClose={close} onSave={(item) => saveItem(item, plan.id)} />}
    {modal?.type === 'action' && plan && <ActionForm plan={plan} item={modal.item} onClose={close} onSave={(action) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: ['submitted', 'validated'].includes(item.reviewStatus) ? 'draft' : item.reviewStatus, actions: [...item.actions, action], history: [...item.history, historyEntry(`Ação adicionada: ${action.title}.`, actor)] }), 'Ação adicionada.'); close(); }} />}
    {modal?.type === 'stage' && plan && <StageForm plan={plan} onClose={close} onSave={(stage) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: ['submitted', 'validated'].includes(item.reviewStatus) ? 'draft' : item.reviewStatus, actions: item.actions.map((action) => action.id === modal.action.id ? { ...action, tasks: [...action.tasks, { id: uid(), ...stage, status: 'not_started', justification: '' }] } : action), history: [...item.history, historyEntry(`Etapa adicionada: ${stage.title}.`, actor)] }), 'Etapa adicionada.'); close(); }} />}
    {modal?.type === 'risk' && plan && <RiskForm item={modal.item} action={modal.action} stage={modal.stage} risk={modal.risk} onClose={close} onSave={(nextRisk) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: ['submitted', 'validated'].includes(item.reviewStatus) ? 'draft' : item.reviewStatus, risks: modal.risk ? item.risks.map((current) => current.id === nextRisk.id ? nextRisk : current) : [...(item.risks || []), nextRisk], history: [...item.history, historyEntry(`${modal.risk ? 'Risco atualizado' : 'Risco adicionado'}: ${nextRisk.title}.`, actor)] }), modal.risk ? 'Risco atualizado.' : 'Risco adicionado.'); close(); }} />}
    {modal?.type === 'measurement' && plan && <MeasurementForm plan={plan} item={modal.item} year={modal.period} onClose={close} onSave={(entry) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: 'draft', measurements: [...item.measurements, entry], history: [...item.history, historyEntry(`Resultado registrado para ${periodLabel(plan, item, entry.year)}: ${formatMetricValue(item, entry.value)}${item.metric.unit ? ` ${item.metric.unit}` : ''}. ${entry.note}`, actor)] }), 'Resultado registrado.'); close(); navigate(itemUrl(plan, modal.item.id, 'indicadores', entry.year)); }} />}
    {modal?.type === 'targets' && plan && <TargetsForm plan={plan} item={modal.item} onClose={close} onSave={(targets) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: 'draft', metric: { ...item.metric, targets }, history: [...item.history, historyEntry('Metas atualizadas.', actor)] }), 'Metas salvas.'); close(); }} />}
    {modal?.type === 'review' && plan && <ReviewForm item={modal.item} decision={modal.decision} onClose={close} onSave={({ status, note }) => { changeItem(plan.id, modal.item.id, (item) => ({ ...item, reviewStatus: status, reviewNote: note, history: [...item.history, historyEntry(status === 'validated' ? 'Informações validadas.' : `Correção solicitada: ${note}`, actor)] }), status === 'validated' ? 'Informações validadas.' : 'Correção solicitada.'); close(); }} />}
  </AppShell>;
}

function Home({ data, session, can }) {
  if (!session.authenticated) return <PublicHome plans={data.plans} />;
  const items = data.plans.flatMap((plan) => plan.items.map((item) => ({ plan, item })));
  const internalItems = items.filter(({ plan, item }) => can(PERMISSIONS.VIEW_INTERNAL_PLAN, resourceFor(plan, item)));
  const overdue = internalItems.reduce((total, { item }) => total + item.actions.flatMap((action) => action.tasks).filter((task) => taskOverdue(task)).length, 0);
  const awaiting = items.filter(({ plan, item }) => item.reviewStatus === 'submitted' && can(PERMISSIONS.REVIEW_ITEM, resourceFor(plan, item))).length;
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">VISÃO GERAL</p><h1>{session.authenticated ? `Olá, ${session.user?.name?.split(' ')[0] || 'usuário'}` : 'Planejamento institucional'}</h1><p>{session.authenticated ? 'Acompanhe suas responsabilidades e os resultados dos planos institucionais.' : 'Consulte os planos e resultados publicados pela UFCG.'}</p></div></div>
    <div className="overview-grid"><article><span>Planejamentos disponíveis</span><strong>{data.plans.length}</strong><a href="#/planejamentos">Consultar planos <Icon name="arrow" size={14} /></a></article><article><span>Itens acompanhados</span><strong>{items.length}</strong><small>Iniciativas e metas</small></article>{session.authenticated && internalItems.length > 0 ? <article className={overdue ? 'has-overdue' : undefined}><span>Etapas atrasadas</span><strong>{overdue}</strong><small>Nos seus escopos de acesso</small></article> : <article><span>Planos publicados</span><strong>{data.plans.filter((plan) => plan.status === 'published').length}</strong><small>Consulta disponível</small></article>}{can(PERMISSIONS.VIEW_REVIEW_QUEUE) && <article><span>Aguardando validação</span><strong>{awaiting}</strong><a href="#/validacoes">Abrir fila <Icon name="arrow" size={14} /></a></article>}</div>
    <section className="home-section"><div className="section-heading"><div><h2>Planejamentos em acompanhamento</h2><p className="hint">Visão consolidada dos ciclos institucionais.</p></div><a className="text-button" href="#/planejamentos">Ver todos</a></div><div className="compact-plan-list">{data.plans.map((plan) => <a key={plan.id} href={`#${planUrl(plan.id)}`}><span className={`plan-icon ${plan.type.toLowerCase()}`}><Icon name={plan.type === 'PDI' ? 'book' : 'leaf'} size={18} /></span><span><strong>{plan.shortName}</strong><small>{plan.name}</small></span><span>Etapas concluídas: {executionProgress({ actions: plan.items.flatMap((item) => item.actions) }).percent}%</span><Icon name="chevron" size={14} /></a>)}</div></section>
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
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></div>{rows.length ? <div className="queue-list">{rows.map(({ plan, item }) => <a key={`${plan.id}-${item.id}`} href={`#${itemUrl(plan, item.id)}`}><span><Badge tone={plan.type === 'PDI' ? 'blue' : 'green'}>{plan.shortName}</Badge><strong>{item.code} · {item.title}</strong><small>{item.owner}</small></span><span><Badge tone={statusTone(reviewStatusLabel(item.reviewStatus))}>{reviewStatusLabel(item.reviewStatus)}</Badge><Icon name="chevron" size={14} /></span></a>)}</div> : <Empty title={empty}>Quando houver novos itens, eles aparecerão aqui.</Empty>}</div>;
}

function PlanList({ data, can, onCreate }) {
  const [filter, setFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const filtered = data.plans.filter((plan) => (filter === 'Todos' || plan.type === filter) && normalize(`${plan.shortName} ${plan.name}`).includes(normalize(search)));
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">PLANEJAMENTOS</p><h1>Planos institucionais</h1><p>Acompanhe estrutura, execução e resultados em um único lugar.</p></div>{can(PERMISSIONS.MANAGE_PLAN) && <Button icon="plus" variant="primary" onClick={onCreate}>Novo planejamento</Button>}</div>
    <div className="list-toolbar"><div className="segmented" aria-label="Filtrar tipo de planejamento">{['Todos', 'PDI', 'PLS'].map((value) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><div className='searchbar'><Input id="input-search-medium" size="medium" type="search" aria-label="Buscar planejamento" placeholder="Buscar planejamento…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
    {filtered.length ? <div className="plan-grid">{filtered.map((plan) => { const progress = executionProgress({ actions: plan.items.flatMap((item) => item.actions) }); return <article className={`plan-card ${plan.type.toLowerCase()}`} key={plan.id}><div className="plan-card-header"><div className="plan-identity"><span className="plan-icon"><Icon name={plan.type === 'PDI' ? 'book' : 'leaf'} size={22} /></span><div className="plan-card-title"><h2>{plan.shortName}</h2><span>{plan.start}–{plan.end}</span></div></div><Badge tone={plan.status === 'published' ? 'green' : 'neutral'}>{plan.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge></div><p className="plan-full-name">{plan.name}</p><div className="plan-card-progress">{progress.total ? <><p className="hint">Execução das etapas</p><Progress {...progress} /><small>{progress.done} de {progress.total} etapas ativas concluídas</small></> : <p className="hint">Sem etapas ativas</p>}</div><div className="plan-card-footer"><div className="card-facts"><span>{plan.axes.length} eixos</span><span>{plan.items.length} {plan.template.labels.item.toLowerCase()}{plan.items.length !== 1 ? 's' : ''}</span></div><Button onClick={() => window.location.href = `#${planUrl(plan.id)}`} aria-label={`Abrir ${plan.shortName} ${plan.start}–${plan.end}`}>Abrir planejamento<Icon name="arrow" size={15} /></Button></div></article>; })}</div> : <Empty title={data.plans.length ? "Nenhum planejamento encontrado" : "Nenhum plano disponível no momento"} action={data.plans.length ? <Button onClick={() => { setFilter('Todos'); setSearch(''); }}>Limpar filtros</Button> : undefined}>{data.plans.length ? 'Tente outro nome ou tipo.' : 'Os planos aparecerão aqui quando estiverem disponíveis para consulta.'}</Empty>}
  </div>;
}

function Models({ templates, onEdit, onUse }) {
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">CONFIGURAÇÃO</p><h1>Modelos de plano</h1><p>Defina a terminologia e os campos adicionais dos novos planejamentos.</p></div></div><div className="models-grid">{templates.map((template) => <article className="model-card" key={template.id}><div className="section-heading"><Badge tone={template.type === 'PDI' ? 'blue' : 'green'}>{template.type}</Badge><span className="muted text-sm">Versão {template.version}</span></div><h2>{template.name}</h2><p>{template.description}</p><div className="model-tree">{[template.labels.axis, template.labels.objective, template.labels.item, 'Ação', 'Etapa'].map((label, index) => <div key={label} style={{ marginLeft: index * 20 }}><Icon name={index === 4 ? 'check' : 'layers'} size={14} />{label}{index === 2 && <span>Indicador + metas</span>}</div>)}</div><div className="model-buttons"><Button icon="edit" onClick={() => onEdit(template)}>Editar modelo</Button><Button variant="primary" onClick={() => onUse(template)}>Criar plano<Icon name="arrow" size={15} /></Button></div></article>)}</div></div>;
}

function ImportacaoPlanilha({ planId, onImport }) {
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState('');
  const inputRef = React.useRef(null);
  const escolherArquivo = () => { setErro(''); inputRef.current?.click(); };
  const arquivoSelecionado = async (event) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo) return;
    setImportando(true);
    setErro('');
    try {
      await onImport(planId, arquivo);
    } catch (err) {
      setErro(err.message || 'Não foi possível importar a planilha.');
    } finally {
      setImportando(false);
    }
  };
  return <div className="import-tools">
    <Button icon="download" onClick={baixarModeloPlanilha}>Baixar modelo</Button>
    <Button icon="upload" onClick={escolherArquivo} disabled={importando}>{importando ? 'Importando…' : 'Importar planilha'}</Button>
    <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={arquivoSelecionado} aria-label="Selecionar planilha para importar" />
    {erro && <p role="alert" className="form-error">{erro}</p>}
  </div>;
}

function PlanPage(props) {
  const { plan, can, onModal, onImportPlanilha } = props;
  if (plan.type !== 'PDI') return <PlanExplorer {...props} />;
  return <PdiWorkspace {...props} actions={({ axis, objective, item }) => !item && can(PERMISSIONS.MANAGE_PLAN, resourceFor(plan)) && <div className="heading-actions"><Button icon="layers" onClick={() => onModal({ type: 'structure' })}>Estrutura</Button><ImportacaoPlanilha planId={plan.id} onImport={onImportPlanilha} />{plan.objectives.some((entry) => !axis || entry.axisId === axis.id) && <Button variant="primary" icon="plus" onClick={() => onModal({ type: 'item', axisId: axis?.id, objectiveId: objective?.id })}>Adicionar {plan.template.labels.item.toLowerCase()}</Button>}</div>} renderDetail={(context) => <PlanItemDetail {...props} {...context} />} />;
}

function PlanItemDetail({ plan, item, action, stage, view, route, actor, can, onModal, changeItem }) {
  const selectedPeriod = Number(route.query.get('period'));
  const period = periods(plan, item).includes(selectedPeriod) ? selectedPeriod : currentPeriod(plan, item);
  const setPeriod = (next) => navigate(itemUrl(plan, item, 'indicadores', next));
  return <AttachmentsProvider key={item.id} itemId={item.id} enabled={can(PERMISSIONS.VIEW_INTERNAL_PLAN, resourceFor(plan, item))}>{view === 'acao' && action ? <ActionDetail plan={plan} item={item} action={action} actor={actor} can={can} onModal={onModal} changeItem={changeItem} /> : view === 'riscos' && action ? <ActionRiskDetail plan={plan} item={item} action={action} stage={stage} actor={actor} can={can} onModal={onModal} changeItem={changeItem} /> : <ItemDetail plan={plan} item={item} actor={actor} can={can} view={view} period={period} setPeriod={setPeriod} onModal={onModal} changeItem={changeItem} />}</AttachmentsProvider>;
}

function PlanExplorer({ plan, actor, can, route, onModal, changeItem, onImportPlanilha }) {
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState([]);
  const filtered = plan.items.filter((item) => { const axis = axisFor(plan, item); const objective = objectiveFor(plan, item); return normalize(`${item.code} ${item.title} ${axisLabel(axis)} ${objective?.title}`).includes(normalize(search)) && (!owner || item.owner === owner) && (!status || executionStatus(item) === status); });
  const item = filtered.find((candidate) => candidate.id === route.query.get('item')) || filtered[0];
  const action = item?.actions.find((candidate) => candidate.id === route.query.get('action'));
  const stage = action?.tasks.find((candidate) => candidate.id === route.query.get('stage'));
  const selectedPeriod = Number(route.query.get('period'));
  const period = item && periods(plan, item).includes(selectedPeriod) ? selectedPeriod : currentPeriod(plan, item);
  const resource = resourceFor(plan, item);
  const legacyView = route.query.get('view') || route.query.get('tab');
  const view = action && legacyView === 'riscos' && can(PERMISSIONS.VIEW_RISK, resource) ? 'riscos' : action ? 'acao' : legacyView === 'historico' && can(PERMISSIONS.VIEW_HISTORY, resource) ? 'historico' : 'indicadores';
  const setPeriod = (next) => navigate(itemUrl(plan, item.id, 'indicadores', next));
  const groups = search || owner || status
    ? plan.axes.filter((axis) => filtered.some((candidate) => candidate.axisId === axis.id))
    : plan.axes;
  const toggle = (key) => setExpanded((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const resetFilters = () => { setSearch(''); setOwner(''); setStatus(''); };
  return <div className="plan-page"><div className="plan-page-heading"><div><a className="back-link" href="#/planejamentos">← Todos os planejamentos</a><div className="title-line"><h1>{plan.shortName} <span>{plan.start}–{plan.end}</span></h1><Badge tone={plan.status === 'published' ? 'green' : 'neutral'}>{plan.status === 'published' ? 'Publicado' : 'Rascunho'}</Badge></div><p>{plan.name}</p></div>{can(PERMISSIONS.MANAGE_PLAN, resourceFor(plan)) && <div className="heading-actions"><Button icon="layers" onClick={() => onModal({ type: 'structure' })}>Estrutura</Button><ImportacaoPlanilha planId={plan.id} onImport={onImportPlanilha} />{plan.objectives.length > 0 && <Button variant="primary" icon="plus" onClick={() => onModal({ type: 'item' })}>Adicionar {plan.template.labels.item.toLowerCase()}</Button>}</div>}</div>
    <div className="explorer"><aside className="plan-tree" aria-label="Estrutura do plano"><div className="tree-heading"><h2>Estrutura do plano</h2><span>{plan.items.length} itens</span></div><Input id="input-search-medium" size="medium" type="search" aria-label="Buscar no plano" placeholder="Buscar no plano…" value={search} onChange={(event) => setSearch(event.target.value)} /><div className="tree-filters">
      <Select
        aria-label="Filtrar responsável"
        placeholder="Todos os responsáveis"
        value={owner}
        onChange={(event) => setOwner(event.currentTarget.value)}
        options={Array.from(
          new Set(plan.items.map((item) => item.owner))
        )
          .filter(Boolean)
          .map((owner) => ({
            value: owner,
            label: owner,
          }))}
      /><Select
      aria-label="Filtrar situação"
      placeholder="Todas as situações"
      value={status}
      onChange={(event) => setStatus(event.target.value)}
      options={[
        'Não iniciada',
        'Em andamento',
        'Concluída',
        'Cancelada'
      ]}
    /></div>
    <nav aria-label="Itens do planejamento" className="tree-content">{groups.map((axis) => <div key={axis.id} className="axis-group" style={{ '--axis-color': axis.color }}><button className="tree-group axis" aria-expanded={expanded.includes(axis.id)} onClick={() => toggle(axis.id)}><Icon name="chevron" size={13} className={expanded.includes(axis.id) ? 'rotated' : ''} /><AxisIcon planType={plan.type} axis={axis} /><span>{plan.template.labels.axis} {axisLabel(axis)}</span></button>{expanded.includes(axis.id) && !filtered.some((candidate) => candidate.axisId === axis.id) && <p className="axis-empty">Nenhuma iniciativa cadastrada neste eixo.</p>}{expanded.includes(axis.id) && plan.objectives.filter((objective) => objective.axisId === axis.id && filtered.some((candidate) => candidate.objectiveId === objective.id)).map((objective) => <div className="objective-group" key={objective.id}><button className="tree-group objective" aria-expanded={expanded.includes(objective.id)} onClick={() => toggle(objective.id)}><Icon name="chevron" size={12} className={expanded.includes(objective.id) ? 'rotated' : ''} /><span>{plan.template.labels.objective} {objective.code} · {objective.title}</span></button>{expanded.includes(objective.id) && filtered.filter((candidate) => candidate.objectiveId === objective.id).map((candidate) => <div className="initiative-group" key={candidate.id}><div className="tree-item-row"><button className="tree-expand" aria-label={`${expanded.includes(candidate.id) ? 'Recolher' : 'Expandir'} ações de ${candidate.code}`} aria-expanded={expanded.includes(candidate.id)} onClick={() => toggle(candidate.id)}><Icon name="chevron" size={12} className={expanded.includes(candidate.id) ? 'rotated' : ''} /></button><a href={`#${itemUrl(plan, candidate.id)}`} className={`tree-item ${item?.id === candidate.id && view === 'indicadores' ? 'selected' : ''}`} aria-current={item?.id === candidate.id && view === 'indicadores' ? 'page' : undefined} style={{ '--axis-color': axis.color }}><span className="node-dot" /><span><small>{plan.template.labels.item} {candidate.code}</small>{candidate.title}</span></a></div>{expanded.includes(candidate.id) && <div className="action-tree">{candidate.actions.map((candidateAction) => <a key={candidateAction.id} href={`#${itemUrl(plan, candidate.id, 'acao', undefined, candidateAction.id)}`} className={`tree-action ${item?.id === candidate.id && action?.id === candidateAction.id ? 'selected' : ''}`} aria-current={item?.id === candidate.id && action?.id === candidateAction.id ? 'page' : undefined}><span><small>Ação {candidateAction.code}</small>{candidateAction.title}</span></a>)}</div>}</div>)}</div>)}</div>)}{!filtered.length && <p className="tree-no-results">Nenhum item corresponde aos filtros.</p>}</nav></aside>
    <section className="detail" aria-label="Detalhe do item">{item ? <AttachmentsProvider key={item.id} itemId={item.id} enabled={can(PERMISSIONS.VIEW_INTERNAL_PLAN, resource)}>{view === 'acao' && action ? <ActionDetail plan={plan} item={item} action={action} actor={actor} can={can} onModal={onModal} changeItem={changeItem} /> : view === 'riscos' && action ? <ActionRiskDetail plan={plan} item={item} action={action} stage={stage} actor={actor} can={can} onModal={onModal} changeItem={changeItem} /> : <ItemDetail plan={plan} item={item} actor={actor} can={can} view={view} period={period} setPeriod={setPeriod} onModal={onModal} changeItem={changeItem} />}</AttachmentsProvider> : <Empty title={plan.items.length ? 'Nenhum item encontrado' : 'Estrutura pronta para receber conteúdo'} action={plan.items.length ? <Button onClick={resetFilters}>Limpar filtros</Button> : can(PERMISSIONS.MANAGE_PLAN, resourceFor(plan)) ? <Button onClick={() => onModal({ type: 'structure' })}>Configurar estrutura</Button> : null}>{plan.items.length ? 'Ajuste os filtros para continuar.' : 'Cadastre os eixos e objetivos antes de incluir o primeiro item.'}</Empty>}</section></div></div>;
}

  function ItemHeader({ plan, item, actor, can, onModal, changeItem, hideDetails = false, scoped = false, children }) {
  const axis = axisFor(plan, item);
  const objective = objectiveFor(plan, item);
  const resource = resourceFor(plan, item);
  const canSeeWorkflow = can(PERMISSIONS.SUBMIT_ITEM, resource) || can(PERMISSIONS.REVIEW_ITEM, resource) || can(PERMISSIONS.VIEW_HISTORY, resource);
  const presentExtra = (field, value) => field.type === 'date' ? formatDate(value) : field.type === 'number' ? formatNumber(value) : value;
  const extraFields = plan.template.fields.filter((field) => item.extras?.[field.id] !== '' && item.extras?.[field.id] != null);
  const submit = () => changeItem(plan.id, item.id, (current) => ({ ...current, reviewStatus: 'submitted', reviewNote: '', history: [...current.history, historyEntry('Informações enviadas para validação.', actor)] }), 'Enviado para validação.');
  return <>{!hideDetails && <div className="item-heading" style={{ '--axis-color': axis?.color || '#2f78a5' }}><div className="section-heading"><div className="flex items-center gap-3"><span className="item-code">{plan.template.labels.item} {item.code}</span><Badge tone={statusTone(executionStatus(item))}>{executionStatus(item)}</Badge></div>{can(PERMISSIONS.EDIT_ITEM, resource) && <Button icon="edit" variant="tertiary" onClick={() => onModal({ type: 'item', item })}>Editar informações</Button>}</div>{!scoped && <h2>{item.title}</h2>}<p>{item.description}</p><div className="item-meta"><span><Icon name="layers" size={15} /><strong>{objective?.code} · {objective?.title}</strong></span><span><Icon name="user" size={15} /><strong>{item.owner}</strong></span>{item.partners && <span>Parceiros: {item.partners}</span>}</div>{extraFields.length > 0 && <div className="extra-values">{extraFields.map((field) => <span key={field.id}><b>{field.label}:</b> {presentExtra(field, item.extras[field.id])}</span>)}</div>}</div>}
    {canSeeWorkflow && <div className={`workflow-banner ${item.reviewStatus}`}><div><span>Validação</span><strong>{reviewStatusLabel(item.reviewStatus)}</strong>{item.reviewNote && <p>{item.reviewNote}</p>}</div><div>{can(PERMISSIONS.SUBMIT_ITEM, resource) && ['draft', 'changes_requested'].includes(item.reviewStatus) && <Button variant="primary" onClick={submit}>Enviar para validação</Button>}{can(PERMISSIONS.REVIEW_ITEM, resource) && item.reviewStatus === 'submitted' && <><Button onClick={() => onModal({ type: 'review', item, decision: 'changes_requested' })}>Solicitar correção</Button><Button variant="primary" onClick={() => onModal({ type: 'review', item, decision: 'validated' })}>Validar</Button></>}</div></div>}
    {item.linkedPlan && <a className="linked-plan" href={`#${planUrl(item.linkedPlan)}`}><Icon name="link" size={16} /><span>Relacionado ao Plano Diretor de Logística Sustentável</span><Icon name="arrow" size={14} /></a>}{children}</>;
}

function ItemDetail({ plan, item, actor, can, view, period, setPeriod, onModal, changeItem }) {
  const resource = resourceFor(plan, item);
  return <ItemHeader scoped={plan.type === 'PDI'} plan={plan} item={item} actor={actor} can={can} onModal={onModal} changeItem={changeItem}>
    {can(PERMISSIONS.VIEW_HISTORY, resource) && <div className="detail-actions"><a className={view === 'historico' ? 'active' : ''} href={`#${itemUrl(plan, item.id, 'historico')}`}>Histórico</a></div>}
    {view === 'historico' ? <History item={item} canComment={can(PERMISSIONS.COMMENT_HISTORY, resource)} onComment={(text) => changeItem(plan.id, item.id, (current) => ({ ...current, history: [...current.history, historyEntry(text, actor)] }), 'Observação adicionada.')} /> : <>
      <Indicators key={item.id} item={item} can={can} plan={plan} period={period} setPeriod={setPeriod} onRecord={() => onModal({ type: 'measurement', item, period })} onTargets={() => onModal({ type: 'targets', item })} />
      <div className="section-heading actions-heading"><h3>Ações estratégicas <span>{item.actions.length}</span></h3>{can(PERMISSIONS.MANAGE_ACTION, resource) && <Button icon="plus" onClick={() => onModal({ type: 'action', item })}>Adicionar ação</Button>}</div>
      {item.actions.length ? <div className="actions-list">{item.actions.map((action) => <a key={action.id} className="action-overview-link" href={`#${itemUrl(plan, item.id, 'acao', undefined, action.id)}`}><span><small>Ação {action.code}</small><strong>{action.title}</strong></span><span>{actionProgress(action).percent}% <Icon name="chevron" size={14} /></span></a>)}</div> : <Empty title="Nenhuma ação cadastrada">As ações desta iniciativa aparecerão aqui.</Empty>}
    </>}
    <footer className="source-note"><Icon name="info" size={13} />{item.source}</footer>
  </ItemHeader>;
}

function ActionDetail({ plan, item, action, actor, can, onModal, changeItem }) {
  return <ItemHeader scoped={plan.type === 'PDI'} plan={plan} item={item} actor={actor} can={can} onModal={onModal} changeItem={changeItem} hideDetails>
    <div className="action-detail-heading">
      <div className="action-detail-info">
        <span className="item-code">Ação {action.code}</span>
        {plan.type !== 'PDI' && <h2>{action.title}</h2>}
        <div className="item-meta"><span>Responsável: <strong>{action.owner}</strong></span><span>Prazo: <strong>{formatDate(action.deadline)}</strong></span></div>
      </div>
      <div className="action-detail-cta">
        {can(PERMISSIONS.VIEW_RISK, resourceFor(plan, item)) && <Button variant="tertiary" icon="danger" onClick={() => navigate(itemUrl(plan, item.id, 'riscos', undefined, action.id))}>Riscos da ação ({item.risks.filter((risk) => risk.actionId === action.id).length})</Button>}
        {(can(PERMISSIONS.MANAGE_ACTION, resourceFor(plan, item)) || can(PERMISSIONS.UPDATE_STAGE, resourceFor(plan, item))) && <Button variant="tertiary" icon="plus" onClick={() => onModal({ type: 'stage', item, action })}>Adicionar etapa</Button>}
      </div>
    </div>
    <Actions item={item} action={action} actor={actor} can={can} plan={plan} onAdd={() => onModal({ type: 'action', item })} onModal={onModal} onChange={(change, message) => changeItem(plan.id, item.id, (current) => ({ ...change(current), reviewStatus: ['submitted', 'validated'].includes(current.reviewStatus) ? 'draft' : current.reviewStatus }), message)} />
    <footer className="source-note"><Icon name="info" size={13} />{item.source}</footer>
  </ItemHeader>;
}

function ActionRiskDetail({ plan, item, action, stage, actor, can, onModal, changeItem }) {
  const resource = resourceFor(plan, item);
  return <ItemHeader scoped={plan.type === 'PDI'} plan={plan} item={item} actor={actor} can={can} onModal={onModal} changeItem={changeItem} hideDetails>
    <div className="risk-detail-header">
      <div>
        <h3>{stage ? 'Riscos da etapa' : 'Riscos da ação'}</h3>
        {plan.type !== 'PDI' && <h2>{stage?.title || action.title}</h2>}
        {stage && <p>Ação {action.code} · {action.title}</p>}
      </div>
      {stage && <div className="risk-detail-deadline">Prazo: <strong>{formatDate(stage.deadline)}</strong></div>}
    </div>
    <a className="back-link" href={`#${itemUrl(plan, item.id, 'acao', undefined, action.id)}`}>← Voltar à ação</a>
    <Risks key={`${action.id}:${stage?.id || 'all'}`} item={item} action={action} stage={stage} canEdit={can(PERMISSIONS.MANAGE_RISK, resource)} onAdd={() => onModal({ type: 'risk', item, action, stage })} onEdit={(risk) => onModal({ type: 'risk', item, action, stage, risk })} />
    <footer className="source-note"><Icon name="info" size={13} />{item.source}</footer>
  </ItemHeader>;
}

function StageRow({ task, action, actor, canUpdate, canManageAction, canViewRisk, riskCount, onChange, onViewRisks, itemId }) {
  const [justifying, setJustifying] = useState(false);
  const [justification, setJustification] = useState(task.justification || '');
  const [justificationModalOpen, setJustificationModalOpen] = useState(false);
  const [editingJustification, setEditingJustification] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [error, setError] = useState('');
  const overdue = taskOverdue(task);
  const cancelJustification = () => { setPendingStatus(null); setJustifying(false); setJustification(task.justification || ''); setError(''); };
  const openJustification = () => { setJustification(task.justification || ''); setEditingJustification(false); setJustificationModalOpen(true); setError(''); };
  const closeJustification = () => { setJustificationModalOpen(false); setEditingJustification(false); setJustification(task.justification || ''); setError(''); };
  const changeStatus = (status) => {
    if (status === 'cancelled' && task.status !== 'cancelled') {
      setPendingStatus(status);
      setJustification('');
      setJustifying(true);
      setError('');
      return;
    }
    cancelJustification();
    if (status === task.status) return;
    onChange((current) => ({ ...current, actions: current.actions.map((candidate) => candidate.id === action.id ? { ...candidate, tasks: candidate.tasks.map((stage) => stage.id === task.id ? { ...stage, status } : stage) } : candidate), history: [...current.history, historyEntry(`Etapa “${task.title}” alterada para ${stageStatusLabel(status)}.`, actor)] }), 'Situação da etapa atualizada.');
  };
  const saveJustification = (event) => {
    event.preventDefault();
    const note = justification.trim();
    if (!note) return setError('Informe uma justificativa.');
    onChange((current) => ({
      ...current,
      actions: current.actions.map((candidate) => candidate.id === action.id ? { ...candidate, tasks: candidate.tasks.map((stage) => stage.id === task.id ? { ...stage, status: pendingStatus || stage.status, justification: note } : stage) } : candidate),
      history: [...current.history, historyEntry(pendingStatus ? `Etapa “${task.title}” cancelada. Justificativa: ${note}` : `Justificativa registrada para a etapa “${task.title}”.`, actor)],
    }), pendingStatus ? 'Etapa cancelada com justificativa.' : 'Justificativa salva.');
    setPendingStatus(null);
    setJustifying(false);
    setError('');
    setJustificationModalOpen(false);
    setEditingJustification(false);
  };
  const removeStage = () => {
    if (riskCount > 0) return;
    onChange((current) => ({
      ...current,
      actions: current.actions.map((candidate) => candidate.id === action.id ? { ...candidate, tasks: candidate.tasks.filter((stage) => stage.id !== task.id) } : candidate),
      history: [...current.history, historyEntry(`Etapa removida: ${task.title}.`, actor)],
    }), 'Etapa removida.');
    setConfirmingRemoval(false);
  };
  return <div className={`task-row ${task.status === 'completed' ? 'done' : ''} ${!canUpdate ? 'read-only' : ''} ${overdue ? 'overdue' : ''}`}>
    <div className="task-main"><span className="stage-field-label">Etapa:</span><strong>{task.title}</strong>{task.partners && <small>Parceiros: {task.partners}</small>}</div>
    <div className="task-deadline"><span className="stage-field-label">Prazo:</span><time dateTime={task.deadline}>{formatDate(task.deadline)}</time>{overdue && <span className="overdue-label">Atrasada</span>}</div>
    <div className="stage-control">
      <span className="stage-field-label">Situação:</span>
      {canUpdate ? <Select
        className="stage-status-select"
        aria-label={`Situação de ${task.title}`}
        value={pendingStatus || task.status}
        onChange={(event) => changeStatus(event.target.value)}
        options={Object.entries(stageStatusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      /> : <Badge tone={statusTone(stageStatusLabel(task.status))}>{stageStatusLabel(task.status)}</Badge>}
    </div>
    <div className="stage-tools">
      {!justifying && canUpdate && (overdue || task.status === 'cancelled') && !task.justification && <Button variant="tertiary" icon="edit" aria-expanded={false} onClick={() => { setJustification(''); setJustifying(true); setError(''); }}>{task.status === 'cancelled' ? 'Justificar cancelamento' : 'Justificar atraso'}</Button>}
      {canViewRisk && <Button variant="tertiary" icon="danger" onClick={() => onViewRisks(task)}>Riscos</Button>}
      <Attachments itemId={itemId} etapaId={task.id} canManage={canUpdate} buttonVariant="tertiary" />
    </div>
    {task.justification && <Button variant="tertiary" icon="eye" className="justification-trigger" onClick={openJustification}>Ver justificativa</Button>}
    {canManageAction && riskCount === 0 && <Button variant="tertiary" icon="close" className="remove-stage-button" onClick={() => setConfirmingRemoval(true)}>Remover etapa</Button>}
    <div className="stage-footer">
      {canManageAction && riskCount > 0 && <p className="hint">Reatribua os {riskCount} risco{riskCount === 1 ? '' : 's'} desta etapa antes de removê-la.</p>}
      {justifying && canUpdate && <form className="justification-form" onSubmit={saveJustification}><label htmlFor={`justification-${task.id}`}>{pendingStatus ? 'Justificativa do cancelamento' : 'Justificativa da etapa'}</label>{pendingStatus && <p className="justification-help">A situação só será alterada após a confirmação.</p>}<textarea id={`justification-${task.id}`} rows="2" maxLength={400} value={justification} onChange={(event) => setJustification(event.target.value)} placeholder={pendingStatus ? 'Explique por que esta etapa será cancelada.' : 'Informe a causa e, se possível, a nova previsão.'} />{error && <p role="alert" className="form-error">{error}</p>}<div><Button type="button" onClick={cancelJustification}>Cancelar</Button><Button type="submit" variant="primary">{pendingStatus ? 'Confirmar cancelamento' : 'Salvar justificativa'}</Button></div></form>}
    </div>
    {justificationModalOpen && <Modal title="Justificativa da etapa" subtitle={task.title} onClose={closeJustification}>
      <form onSubmit={saveJustification}>
        <div className="form-body">
          {!editingJustification ? <p className="justification-modal-text">{task.justification}</p> : <><label htmlFor={`justification-modal-${task.id}`}>Justificativa da etapa</label><textarea id={`justification-modal-${task.id}`} rows="5" maxLength="400" value={justification} onChange={(event) => setJustification(event.target.value)} /></>}
          {error && <p role="alert" className="form-error">{error}</p>}
        </div>
        <div className="form-end">
          <Button type="button" onClick={closeJustification}>Fechar</Button>
          {!editingJustification ? <Button type="button" variant="primary" icon="edit" onClick={() => setEditingJustification(true)}>Editar justificativa</Button> : <Button type="submit" variant="primary">Salvar justificativa</Button>}
        </div>
      </form>
    </Modal>}
    {confirmingRemoval && <Modal title="Remover etapa?" subtitle={task.title} onClose={() => setConfirmingRemoval(false)}>
      <div className="form-body"><p>Tem certeza de que deseja remover esta etapa? Essa ação não pode ser desfeita.</p></div>
      <div className="form-end"><Button onClick={() => setConfirmingRemoval(false)}>Cancelar</Button><Button variant="primary" className="danger-primary" onClick={removeStage}>Remover etapa</Button></div>
    </Modal>}
  </div>;
}

function Actions({ item, action: selectedAction, actor, can, plan, onAdd, onModal, onChange }) {
  const [expanded, setExpanded] = useState(selectedAction ? [selectedAction.id] : []);
  const progress = selectedAction ? actionProgress(selectedAction) : executionProgress(item);
  const resource = resourceFor(plan, item);
  const canManageAction = can(PERMISSIONS.MANAGE_ACTION, resource);
  const canUpdateStage = can(PERMISSIONS.UPDATE_STAGE, resource);
  const canViewRisk = can(PERMISSIONS.VIEW_RISK, resource);
  const toggleAction = (actionId) => setExpanded((current) => current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId]);

  return <>
    <div className="execution-summary" style={{ '--axis-color': axisFor(plan, item)?.color || '#2f78a5' }}>
      <span>Execução das etapas</span>
      <strong>{progress.total ? `${progress.percent}%` : '—'}</strong>
      <span className="execution-count">{progress.done} de {progress.total} etapas ativas concluídas</span>
      <div className="execution-bar" role="progressbar" aria-label="Execução das etapas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-valuetext={`${progress.done} de ${progress.total} etapas ativas concluídas`}><span style={{ width: `${progress.percent}%` }} /></div>
    </div>
    {!selectedAction && <div className="section-heading actions-heading">
      <h3>Ações estratégicas <span>{item.actions.length}</span></h3>
      {canManageAction && <Button icon="plus" onClick={onAdd}>Adicionar ação</Button>}
    </div>}
    {!item.actions.length && <Empty title="Nenhuma ação cadastrada">Adicione uma ação para organizar sua execução.</Empty>}
    <div className="actions-list">
      {(selectedAction ? [selectedAction] : item.actions).map((action) => {
        const state = actionProgress(action);
        const closed = !expanded.includes(action.id);
        return <article className="action-card" key={action.id} style={{ '--axis-color': axisFor(plan, item)?.color || '#2f78a5' }}>
          {!selectedAction && <div className="action-header">
            <button className="action-heading" aria-expanded={!closed} onClick={() => toggleAction(action.id)}>
              <span className="action-name"><span className="action-number">{action.code}</span><span className="action-title">{action.title}</span><small>{action.owner} <span>·</span> Prazo: {formatDate(action.deadline)}</small></span>
            </button>
            {(canManageAction || canUpdateStage) && <Button variant="tertiary" icon="plus" className="add-task" onClick={() => onModal({ type: 'stage', item, action })}>Adicionar etapa<span className="sr-only"> em {action.title}</span></Button>}
            <span className="task-count"><span>{state.done} de {state.total} {state.total === 1 ? 'etapa concluída' : 'etapas concluídas'}</span><strong>{state.percent}%</strong></span>
            <Icon name="chevron" size={14} className={!closed ? 'rotated' : ''} />
          </div>}
          {(selectedAction || !closed) && <div className="action-body">
            {action.tasks.map((task) => <StageRow key={task.id} task={task} action={action} actor={actor} canUpdate={canUpdateStage} canManageAction={canManageAction} canViewRisk={canViewRisk} riskCount={(item.risks || []).filter((risk) => risk.actionId === action.id && risk.stage === task.title).length} onViewRisks={() => navigate(itemUrl(plan, item.id, 'riscos', undefined, action.id, task.id))} onChange={onChange} itemId={item.id} />)}
            {!action.tasks.length && <p className="hint px-5 pt-3">Esta ação ainda não possui etapas.</p>}
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
      <Field label={item.metric.periodicity === 'final' ? 'Período' : 'Ano de referência'} className="year-field"><Select
        value={period}
        onChange={(event) => setPeriod(Number(event.target.value))}
        options={list.map((value) => ({
          value,
          label: periodLabel(plan, item, value),
        }))}
      /></Field>
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
        {can(PERMISSIONS.EDIT_TARGET, resource) && <Button variant="tertiary" onClick={onTargets}>Editar metas</Button>}
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
    <div className="measurements"><h3>Registros do período</h3>{measurements.length ? measurements.map((entry) => <article className="measurement" key={entry.id}><div><strong>{metricValue(entry.value)}</strong><time>{formatDate(entry.at)}</time></div><p>{entry.note}</p>{entry.evidence && <a href={entry.evidence} target="_blank" rel="noreferrer">Abrir evidência <Icon name="arrow" size={13} /></a>}<Attachments itemId={item.id} resultadoId={entry.id} canManage={canRecord} /></article>) : <p className="hint">Nenhum registro manual para este período.</p>}</div>
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

function Risks({ item, action, stage, canEdit, onAdd, onEdit }) {
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const risks = (item.risks || []).filter((entry) => (!action || entry.actionId === action.id) && (!stage || entry.stage === stage.title));
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
        <div className="risk-panel-context" aria-hidden="true" />
        <div className="flex items-center gap-3"><Badge>{risks.length} registros</Badge>{canEdit && <Button icon="plus" onClick={onAdd}>Adicionar risco</Button>}</div>
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
