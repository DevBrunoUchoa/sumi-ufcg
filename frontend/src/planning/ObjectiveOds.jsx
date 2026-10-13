import { odsForObjective } from './ods.js';

function OdsIcons({ icons }) {
  return <ul className="objective-ods-icons" aria-label="Objetivos de Desenvolvimento Sustentável vinculados">{icons.map((icon) => {
    const label = `ODS ${icon.id} — ${icon.title}`;
    return <li key={icon.id}><a href={icon.page} target="_blank" rel="noopener noreferrer" aria-label={`${label} (abre em nova aba)`} title={label}><img src={icon.path} alt={label} width="64" height="64" /></a></li>;
  })}</ul>;
}

export function ObjectiveOds({ plan, objective }) {
  const icons = odsForObjective(plan, objective);
  if (!icons.length) return null;
  return <div className="objective-ods">
    <span className="objective-ods-label">ODS vinculadas</span>
    {icons.length === 17 ? <details className="objective-ods-all"><summary>Todas as 17 ODS</summary><OdsIcons icons={icons} /></details> : <OdsIcons icons={icons} />}
  </div>;
}
