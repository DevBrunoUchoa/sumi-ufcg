import { useId } from 'react';
import { formatMetricValue, formatNumber, metricResult, periods } from '../domain.js';
import { numericValue } from './selectors.js';

const percentLabel = (value) => `${formatNumber(value)}%`;

function DataTable({ caption, headings, rows }) {
  return <details className="chart-data"><summary>Ver dados em tabela</summary><div className="chart-table-wrap"><table><caption>{caption}</caption><thead><tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div></details>;
}

export function ExecutionChart({ title, description, rows, summary }) {
  const id = useId();
  return <section className="br-card planning-chart" aria-labelledby={id}><div className="card-content"><h3 id={id}>{title}</h3>
    {summary && <div className="chart-scope-summary">{summary.total ? <><strong>{percentLabel(summary.percent)} concluído</strong><span>{summary.done} de {summary.total} etapas ativas concluídas</span></> : <span>Sem etapas ativas</span>}</div>}
    <details className="chart-method"><summary>Como este cálculo funciona</summary><p className="hint">{description}</p></details>
    {rows.length ? <><div className="chart-scale" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div><div className="chart-comparison" tabIndex={rows.length > 6 ? 0 : undefined} role={rows.length > 6 ? 'region' : undefined} aria-label={rows.length > 6 ? title : undefined}>{rows.map((row) => <div className="chart-row" key={row.id}>
      <div className="chart-row-label">{row.url ? <a href={`#${row.url}`}>{row.label}</a> : <span>{row.label}</span>}<small>{row.execution.total ? `${row.execution.done} de ${row.execution.total} etapas ativas concluídas` : 'Sem etapas ativas'}</small></div>
      <div className="chart-bar-track" aria-hidden="true"><span style={{ width: `${row.execution.percent}%` }} /></div><strong>{row.execution.total ? percentLabel(row.execution.percent) : '—'}</strong>
    </div>)}</div><DataTable caption={title} headings={['Escopo', 'Concluídas / ativas', 'Execução']} rows={rows.map((row) => [row.label, `${row.execution.done} / ${row.execution.total}`, row.execution.total ? percentLabel(row.execution.percent) : 'Sem etapas ativas'])} /></> : <p className="chart-empty">Nenhum conteúdo disponível para comparação.</p>}
  </div></section>;
}

export function DistributionChart({ title, description, values, noun }) {
  const id = useId();
  const total = values.reduce((sum, entry) => sum + entry.value, 0);
  return <section className="br-card planning-chart" aria-labelledby={id}><div className="card-content"><h3 id={id}>{title}</h3><p className="hint">{description}</p>
    <div className="chart-total"><strong>{total}</strong><span>{noun}</span></div>
    {total ? <div className="chart-stacked" aria-hidden="true">{values.filter((entry) => entry.value).map((entry) => <span className={`chart-tone-${entry.tone}`} key={entry.key} style={{ width: `${entry.value / total * 100}%` }} />)}</div> : <p className="chart-empty">Sem dados disponíveis neste escopo.</p>}
    <dl className="chart-legend">{values.filter((entry) => entry.key !== 'cycle' || entry.value > 0).map((entry) => <div key={entry.key}><dt><i className={`chart-tone-${entry.tone}`} aria-hidden="true" />{entry.label}</dt><dd><strong>{entry.value}</strong><span>{total ? percentLabel(Math.round(entry.value / total * 1000) / 10) : '—'}</span></dd></div>)}</dl>
    <DataTable caption={title} headings={['Situação', 'Quantidade', 'Proporção']} rows={values.map((entry) => [entry.label, entry.value, total ? percentLabel(Math.round(entry.value / total * 1000) / 10) : 'Sem dados'])} />
  </div></section>;
}

export function MetricTrend({ plan, item, period }) {
  const id = useId();
  if (item.metric.valueType === 'status') return null;
  const series = periods(plan, item).map((year) => ({ year, target: numericValue(item.metric.targets[year]), result: numericValue(metricResult(item, year)) }));
  const numbers = series.flatMap((entry) => [entry.target, entry.result]).filter((value) => value !== null);
  const min = Math.min(0, ...numbers); const max = Math.max(1, ...numbers);
  const x = (index) => series.length === 1 ? 310 : 55 + index / (series.length - 1) * 510;
  const y = (value) => 190 - (value - min) / (max - min) * 150;
  const segments = (key) => {
    const groups = []; let group = [];
    series.forEach((entry, index) => { if (entry[key] === null) { if (group.length) groups.push(group); group = []; } else group.push(`${x(index)},${y(entry[key])}`); });
    if (group.length) groups.push(group);
    return groups;
  };
  return <section className="br-card planning-chart metric-trend" aria-labelledby={id}><div className="card-content"><h3 id={id}>Evolução da meta e do resultado</h3><p className="hint">{item.metric.name}{item.metric.unit && ` · ${item.metric.unit}`}. Períodos sem resultado permanecem sem ponto no gráfico.</p>
    {numbers.length ? <svg viewBox="0 0 600 235" role="img" aria-labelledby={`${id}-title ${id}-description`}><title id={`${id}-title`}>Meta e resultado de {item.metric.name}</title><desc id={`${id}-description`}>Comparação por período na mesma unidade do indicador. Os valores estão disponíveis na tabela abaixo.</desc>
      {[min, (min + max) / 2, max].map((value) => <g key={value}><line className="trend-grid" x1="55" x2="565" y1={y(value)} y2={y(value)} /><text x="45" y={y(value) + 4} textAnchor="end">{formatNumber(value)}</text></g>)}
      {series.map((entry, index) => <g key={entry.year}>{entry.year === period && <line className="trend-selection" x1={x(index)} x2={x(index)} y1="30" y2="200" />}<text x={x(index)} y="220" textAnchor="middle">{entry.year}</text></g>)}
      {['target', 'result'].map((key) => <g key={key} className={`trend-${key}`}>{segments(key).map((points, index) => <polyline key={index} points={points.join(' ')} />)}{series.map((entry, index) => entry[key] !== null && <circle key={entry.year} cx={x(index)} cy={y(entry[key])} r="4"><title>{entry.year}: {key === 'target' ? 'Meta' : 'Resultado'} {formatMetricValue(item, entry[key])}</title></circle>)}</g>)}
    </svg> : <p className="chart-empty">Sem metas ou resultados numéricos disponíveis para este indicador.</p>}
    <div className="trend-legend"><span><i className="trend-target-key" aria-hidden="true" />Meta</span><span><i className="trend-result-key" aria-hidden="true" />Resultado</span></div>
    {item.metric.measurementMode === 'stages' && <p className="hint">O resultado do período atual é calculado pelas etapas; anos anteriores usam os resultados registrados.</p>}
    <DataTable caption={`Meta e resultado — ${item.metric.name}`} headings={['Período', 'Meta', 'Resultado']} rows={series.map((entry) => [entry.year, entry.target === null ? 'Sem meta numérica' : formatMetricValue(item, entry.target), entry.result === null ? 'Sem resultado' : formatMetricValue(item, entry.result)])} />
  </div></section>;
}
