import { useEffect, useMemo, useState } from 'react';
import { Icon, Input } from '../ui.jsx';
import { executionStatus } from '../domain.js';
import { itemUrl, objectiveUrl } from './navigation.js';
import { ordered } from './selectors.js';

const TREE_PREFERENCE_KEY = 'sumi.ui.plan-tree-open';

function statusTone(status) {
  if (status === 'Concluída') return 'done';
  if (status === 'Em andamento') return 'active';
  return 'pending';
}

function TreeNode({ label, code, title, href, active, expanded, onToggle, hasChildren, status, level, children }) {
  return <li className={`plan-tree-node level-${level} ${active ? 'active' : ''}`}>
    <div className="plan-tree-row">
      {hasChildren ? <button type="button" className="plan-tree-toggle" aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${title}`} aria-expanded={expanded} onClick={onToggle}><Icon name="chevron" size={12} /></button> : <span className="plan-tree-spacer" />}
      <a href={`#${href}`} title={`${code} ${title}`} aria-current={active ? 'page' : undefined}>
        <span className="plan-tree-label"><strong>{label} {code}</strong><span>{title}</span></span>
        {status && <span className={`plan-tree-status ${statusTone(status)}`} title={status} aria-label={status} />}
      </a>
    </div>
    {hasChildren && expanded && children}
  </li>;
}

export function PlanTree({ plan, context, open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set([context.objective?.id, context.item?.id].filter(Boolean)));
  const axis = context.axis;
  const labels = plan.template.labels;
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const objectives = useMemo(() => ordered(plan.objectives.filter((objective) => objective.axisId === axis.id)), [plan.objectives, axis.id]);
  const matches = (value) => !query || `${value.code} ${value.title}`.toLocaleLowerCase('pt-BR').includes(query);
  const visibleObjectives = objectives.filter((objective) => matches(objective)
    || plan.items.some((item) => item.objectiveId === objective.id && (matches(item) || item.actions.some(matches))));

  useEffect(() => {
    try { localStorage.setItem(TREE_PREFERENCE_KEY, String(open)); } catch { /* preferência não essencial */ }
  }, [open]);

  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const expandPath = () => setExpanded(new Set([context.objective?.id, context.item?.id].filter(Boolean)));
  const collapseAll = () => setExpanded(new Set());

  if (!axis) return null;
  return <aside id="plan-tree-navigation" className={`plan-tree ${open ? 'is-open' : 'is-closed'}`} aria-label="Navegação do eixo">
    {open ? <div className="plan-tree-panel">
      <div className="plan-tree-header">
        <div className="plan-tree-header-label">
          <h2>{plan.template.labels.axis} {axis.code}</h2>
          <span>{axis.name}</span>
        </div>
      </div>
      <div className="plan-tree-search"><Input label="Buscar no eixo" type="search" placeholder="Código ou nome…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="plan-tree-actions">
        <button type="button" onClick={expandPath}>Abrir caminho atual</button>
        <button type="button" onClick={collapseAll}>Recolher tudo</button>
      </div>
      <div className="plan-tree-scroll">
        <ul className="plan-tree-list">
          {visibleObjectives.map((objective) => {
            const items = ordered(plan.items.filter((item) => item.objectiveId === objective.id))
              .filter((item) => matches(objective) || matches(item) || item.actions.some(matches));
            const objectiveOpen = expanded.has(objective.id);
            return <TreeNode key={objective.id} label={labels.objective} code={objective.code} title={objective.title} href={objectiveUrl(plan, objective)} active={context.objective?.id === objective.id && !context.item} expanded={objectiveOpen} onToggle={() => toggle(objective.id)} hasChildren={items.length > 0} level={0}>
              <ul>{items.map((item) => {
                const itemOpen = expanded.has(item.id);
                const actions = ordered(item.actions).filter((action) => matches(item) || matches(action));
                return <TreeNode key={item.id} label={labels.item} code={item.code} title={item.title} href={itemUrl(plan, item)} active={context.item?.id === item.id && !context.action} expanded={itemOpen} onToggle={() => toggle(item.id)} hasChildren={actions.length > 0} status={executionStatus(item)} level={1}>
                  <ul>{actions.map((action) => <TreeNode key={action.id} label="Ação" code={action.code} title={action.title} href={itemUrl(plan, item, 'acao', undefined, action.id)} active={context.action?.id === action.id} expanded={false} hasChildren={false} level={2} />)}</ul>
                </TreeNode>;
              })}</ul>
            </TreeNode>;
          })}
          {!visibleObjectives.length && <li className="plan-tree-empty">Nenhum resultado encontrado.</li>}
        </ul>
      </div>
    </div> : null}
  </aside>;
}
