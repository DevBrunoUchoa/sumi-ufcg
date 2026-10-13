import { years } from '../domain.js';
import { Select } from '../ui.jsx';
import { DistributionChart, ExecutionChart } from './Charts.jsx';
import { stageDistribution, summarizeScope, targetDistribution } from './selectors.js';

export function ScopeDashboard({ plan, items, rows, level, period, onPeriodChange }) {
  return <section className="scope-dashboard" aria-label="Painel de acompanhamento">
    <div className="section-heading dashboard-heading"><div><h2>Acompanhamento {level === 'plan' ? 'do plano' : level === 'axis' ? 'do eixo' : 'do objetivo'}</h2></div>{level !== 'plan' && <Select label="Ano das metas" value={String(period)} onChange={(event) => onPeriodChange(Number(event.target.value))} options={years(plan).map((year) => ({ value: String(year), label: String(year) }))} />}</div>
    <div className="dashboard-grid">
      <ExecutionChart title={level === 'plan' ? 'Execução por eixo' : level === 'axis' ? 'Execução por objetivo' : 'Execução por iniciativa'} description="Proporção de etapas ativas concluídas. Etapas canceladas não entram no cálculo. Esta visão mostra a execução atual, independentemente do ano das metas." summary={summarizeScope(items, 0).execution} rows={rows} />
      {level === 'plan' ? <DistributionChart title="Situação das etapas" description="Distribuição atual de todas as etapas cadastradas, incluindo canceladas." values={stageDistribution(items)} noun="etapas cadastradas" /> : <DistributionChart title={`Situação das metas · ${period}`} description="Cada indicador é comparado à sua própria meta. Metas de ciclo são apresentadas separadamente." values={targetDistribution(items, period, plan)} noun="indicadores neste escopo" />}
    </div>
  </section>;
}
