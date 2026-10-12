import { odsGoal } from './ods.js';

// Selos dos ODS vinculados a um objetivo — usados onde quer que um objetivo
// do PDI seja exibido (visão geral do eixo, página do próprio objetivo).
export function OdsBadges({ ods, size = 'base' }) {
  if (!ods || !ods.length) return null;
  return <ul className={`ods-badges ods-badges-${size}`} aria-label="Objetivos de Desenvolvimento Sustentável vinculados">
    {ods.map((number) => {
      const goal = odsGoal(number);
      if (!goal) return null;
      return <li key={number}><span className="ods-badge" style={{ '--ods-color': goal.color }} title={`ODS ${goal.number} · ${goal.title}`}>{goal.number}<span className="sr-only"> · ODS {goal.number}: {goal.title}</span></span></li>;
    })}
  </ul>;
}
