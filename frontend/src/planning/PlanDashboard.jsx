import { useEffect, useRef, useState } from 'react';
import { formatNumber, years } from '../domain.js';
import { Button, Empty, Icon, Select } from '../ui.jsx';
import { ForbiddenPage, NotFoundPage, UnauthorizedPage } from '../error-pages.jsx';
import { loginUrl } from '../auth/navigation.js';
import { dashboardUrl, itemUrl, objectiveCode, planUrl } from './navigation.js';
import { ordered, targetDistribution } from './selectors.js';
import { DistributionChart, ExecutionChart } from './Charts.jsx';
import { attentionTypes, dashboardComparison, dashboardFacts, dashboardScopeUrl, resolveDashboardScope } from './dashboard-selectors.js';

const go = (url) => { window.location.hash = url; };

export function PlanDashboard({ plan, route, can, authenticated }) {
  const scope = resolveDashboardScope(plan, route.query);
  if (!scope.valid) return <NotFoundPage onGoHome={() => go(dashboardUrl(plan))} />;
  const requested = attentionTypes.find((entry) => entry.key === scope.focus);
  if (requested?.permission && !can(requested.permission)) return authenticated
    ? <ForbiddenPage onGoHome={() => go(dashboardUrl(plan))} /> : <UnauthorizedPage onLogin={() => go(loginUrl(route))} />;
  return <DashboardContent plan={plan} scope={scope} can={can} />;
}

function DashboardContent({ plan, scope, can }) {
  const heading = useRef(null);
  const previousFocus = useRef('all');
  const facts = dashboardFacts(plan, scope.items, scope.period, can);
  const comparison = dashboardComparison(plan, scope);
  const filters = { axis: scope.axis?.id, objective: scope.objective?.id, period: scope.period, focus: scope.focus === 'all' ? '' : scope.focus };
  const change = (next) => go(dashboardUrl(plan, { ...filters, ...next }));
  useEffect(() => {
    if (scope.focus !== 'all' && previousFocus.current !== scope.focus) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start' });
    }
    previousFocus.current = scope.focus;
  }, [scope.focus]);
  const label = scope.objective?.title || scope.axis?.name || 'Todos os eixos';
  const coveragePercent = facts.coverage.total ? Math.round(facts.coverage.withResult / facts.coverage.total * 1000) / 10 : null;
  const entries = facts.entries.filter((entry) => scope.focus === 'all' || entry.reasons.includes(scope.focus));
  const objectiveOptions = ordered(plan.objectives.filter((entry) => !scope.axis || entry.axisId === scope.axis.id));
  return <div className="page plan-dashboard">
    <div className="page-heading dashboard-page-heading"><div><p className="eyebrow">{plan.shortName} {plan.start}–{plan.end}</p><h1 tabIndex={-1}>Painel de acompanhamento</h1><p>{plan.name}</p></div><a className="br-button secondary" href={`#${dashboardScopeUrl(plan, scope)}`}><Icon name="book" size={16} />Explorar {scope.objective ? 'objetivo' : scope.axis ? 'eixo' : 'plano'}</a></div>
    <div className="dashboard-filters" role="group" aria-label="Filtros do painel">
      <Select label="Eixo do painel" value={scope.axis?.id || ''} onChange={(event) => change({ axis: event.target.value, objective: '', focus: '' })} options={[{ value: '', label: 'Todos os eixos' }, ...ordered(plan.axes).map((axis) => ({ value: axis.id, label: `${axis.code} · ${axis.name}` }))]} />
      <Select label="Objetivo do painel" value={scope.objective?.id || ''} onChange={(event) => change({ objective: event.target.value, focus: '' })} options={[{ value: '', label: 'Todos os objetivos' }, ...objectiveOptions.map((objective) => ({ value: objective.id, label: `${objectiveCode(objective)}${objectiveCode(objective) ? ' · ' : ''}${objective.title}` }))]} />
      <Select label="Ano das metas" value={String(scope.period)} onChange={(event) => change({ period: Number(event.target.value) })} options={years(plan).map((year) => ({ value: String(year), label: String(year) }))} />
    </div>
    <div className="dashboard-scope"><p role="status"><strong>{label}</strong> · {scope.items.length} iniciativas</p>{(scope.axis || scope.objective || scope.focus !== 'all') && <Button variant="tertiary" onClick={() => change({ axis: '', objective: '', focus: '' })}>Limpar filtros</Button>}</div>
    {!scope.items.length ? <Empty title="Sem iniciativas neste escopo">Os dados aparecerão no painel quando as iniciativas estiverem disponíveis.</Empty> : <>
      <div className="dashboard-grid dashboard-primary">
        <ExecutionChart headingLevel={2} title={comparison.title} description="Execução atual, calculada pelas etapas ativas. Canceladas ficam fora do cálculo. Os links aprofundam o escopo do painel; o ano selecionado se aplica às metas e aos resultados, não a uma série histórica de execução." rows={comparison.rows} summary={facts.execution} />
        <DistributionChart headingLevel={2} title={`Metas e resultados · ${scope.period}`} description="Cada indicador é comparado à própria meta, respeitando sua unidade e direção. Ausência de resultado fica separada." values={targetDistribution(scope.items, scope.period, plan)} noun="indicadores no escopo" />
      </div>
      <div className="dashboard-grid dashboard-secondary">
        <section className="br-card planning-chart coverage-card" aria-labelledby="dashboard-coverage-title"><div className="card-content"><h2 id="dashboard-coverage-title">Cobertura dos resultados · {scope.period}</h2>
          <p className="hint">Indicadores com resultado informado ou calculado no período.</p>
          <div className="coverage-value"><strong>{coveragePercent === null ? '—' : `${formatNumber(coveragePercent)}%`}</strong><span>{facts.coverage.withResult} de {facts.coverage.total} indicadores aplicáveis com resultado</span></div>
          {coveragePercent !== null && <div className="coverage-track" role="progressbar" aria-label="Indicadores com resultado no período" aria-valuenow={coveragePercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${coveragePercent}%` }} /></div>}
          {facts.coverage.cycle > 0 && <p className="hint">{facts.coverage.cycle} indicadores de ciclo ficam fora desta cobertura; são acompanhados no término do plano.</p>}
          <a className="dashboard-insight-link" href={`#${dashboardUrl(plan, { ...filters, focus: 'missing' })}`}>{facts.coverage.missing} indicadores sem resultado <Icon name="arrow" size={14} /></a>
        </div></section>
        <section className="br-card planning-chart deadline-card" aria-labelledby="dashboard-deadlines-title"><div className="card-content"><h2 id="dashboard-deadlines-title">Prazos das etapas</h2><p className="hint">Situação atual das etapas pendentes com prazo cadastrado.</p>
          <div className="coverage-value"><strong>{facts.deadlines.known ? facts.deadlines.overdue : facts.deadlines.missing ? '—' : 0}</strong><span>{facts.deadlines.known ? 'etapas com prazo vencido' : facts.deadlines.missing ? 'Sem prazos cadastrados' : 'Não há etapas pendentes neste escopo'}</span></div>
          {facts.deadlines.missing > 0 && <p className="hint">{facts.deadlines.missing} etapas pendentes sem prazo informado.</p>}
          <a className="dashboard-insight-link" href={`#${dashboardUrl(plan, { ...filters, focus: 'overdue' })}`}>Ver iniciativas com prazo vencido <Icon name="arrow" size={14} /></a>
        </div></section>
      </div>
      <section className="dashboard-attention" aria-labelledby="dashboard-attention-title"><div className="section-heading"><div><h2 ref={heading} id="dashboard-attention-title" tabIndex={-1}>Pontos de atenção <span className="section-count">{entries.length} iniciativas</span></h2><p className="hint">Abra a iniciativa para consultar as informações e suas ações.</p></div><Select label="Mostrar itens" value={scope.focus} onChange={(event) => change({ focus: event.target.value })} options={[{ value: 'all', label: 'Todos os pontos de atenção' }, ...facts.categories.map((entry) => ({ value: entry.key, label: `${entry.label} (${entry.count})` }))]} /></div>
        <AttentionList key={`${scope.axis?.id}:${scope.objective?.id}:${scope.period}:${scope.focus}`} plan={plan} entries={entries} period={scope.period} />
      </section>
    </>}
    <a className="dashboard-back" href={`#${planUrl(plan.id)}`}>Voltar aos eixos do {plan.shortName}</a>
  </div>;
}

function AttentionList({ plan, entries, period }) {
  const [limit, setLimit] = useState(10);
  if (!entries.length) return <Empty title="Nenhum item encontrado para este filtro">Outros pontos de atenção podem ser consultados pelos filtros do painel.</Empty>;
  return <><div className="br-list dashboard-attention-list">{entries.slice(0, limit).map(({ item, reasons, overdue }) => <article className="br-item attention-row" key={item.id}>
    <div><a href={`#${itemUrl(plan, item, 'indicadores', period)}`}><small>{plan.template.labels.item} {item.code}</small><strong>{item.title}</strong></a><p className="hint">Responsável: {item.owner || 'Não informado'}</p><ul>{reasons.map((key) => <li key={key}>{key === 'overdue' ? `${overdue.length} etapas com prazo vencido` : attentionTypes.find((entry) => entry.key === key).label}</li>)}</ul></div>
    <a className="br-button tertiary small" href={`#${itemUrl(plan, item, 'indicadores', period)}`} aria-label={`Abrir iniciativa ${item.code}`}>Abrir iniciativa <Icon name="arrow" size={14} /></a>
  </article>)}</div><div className="attention-pagination"><p className="hint" role="status">Exibindo {Math.min(limit, entries.length)} de {entries.length} iniciativas</p>{limit < entries.length && <Button onClick={() => setLimit((current) => current + 10)}>Mostrar mais iniciativas</Button>}</div></>;
}
