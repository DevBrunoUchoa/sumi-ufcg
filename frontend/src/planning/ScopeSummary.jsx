// A scope summary can host future charts beside the same facts. It only receives
// derived display data and never performs persistence or authorization itself.
export function ScopeSummary({ summary, axisCount, labels }) {
  const { execution } = summary;
  const facts = axisCount === undefined
    ? [[`${labels.objective}s`, summary.objectives], [`${labels.item}s`, summary.items], ['Ações estratégicas', summary.actions]]
    : [[`${labels.axis}s`, axisCount], [`${labels.objective}s`, summary.objectives], [`${labels.item}s`, summary.items], ['Ações estratégicas', summary.actions]];
  return <section className="planning-summary" aria-label="Resumo do acompanhamento">
    <dl className="planning-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="scope-execution"><span>Execução das etapas</span>{execution.total ? <><strong>{execution.percent}%</strong><div className="progress-track" role="progressbar" aria-label="Etapas concluídas neste escopo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={execution.percent}><span style={{ width: `${execution.percent}%` }} /></div><small>{execution.done} de {execution.total} etapas ativas concluídas</small></> : <p>Sem etapas ativas</p>}</div>
  </section>;
}
