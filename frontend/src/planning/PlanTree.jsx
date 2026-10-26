import { useEffect, useMemo, useState } from 'react';
import { Icon, Input } from '../ui.jsx';
import { itemUrl, objectiveUrl } from './navigation.js';
import { ordered } from './selectors.js';

function TreeNode({ label, code, title, href, active, expanded, onToggle, hasChildren, level, children }) {
  return <li className={`context-tree-node level-${level} ${active ? 'active' : ''}`}>
    <div className="context-tree-row">
      {hasChildren ? <button type="button" className="context-tree-expander" aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${title}`} aria-expanded={expanded} onClick={onToggle}><Icon name="chevron" size={12} /></button> : <span className="context-tree-spacer" />}
      <a href={`#${href}`} title={`${code} ${title}`} aria-current={active ? 'page' : undefined}>
        <span className="context-tree-label"><strong>{label} {code}</strong><span>{title}</span></span>
      </a>
    </div>
    {hasChildren && expanded && children}
  </li>;
}

// Árvore de navegação de um único eixo (objetivos → iniciativas → ações). Os
// riscos continuam acessíveis só pela ação a que pertencem.
export function PlanTree({ plan, context, overlay = false, onClose }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set([context.objective?.id, context.item?.id].filter(Boolean)));
  // A árvore não remonta ao navegar dentro do mesmo eixo (key={axis.id} no
  // AppShell), então sem isto o Set de nós abertos ficava congelado no que
  // era o caminho ativo só no primeiro carregamento — ao entrar numa ação
  // mais funda a árvore parecia "voltar ao início" em vez de acompanhar.
  // Só adiciona ao caminho atual; nunca recolhe o que a pessoa abriu à mão.
  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      if (context.objective?.id) next.add(context.objective.id);
      if (context.item?.id) next.add(context.item.id);
      return next;
    });
  }, [context.objective?.id, context.item?.id]);
  const axis = context.axis;
  const labels = plan.template.labels;
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const objectives = useMemo(() => ordered(plan.objectives.filter((objective) => objective.axisId === axis.id)), [plan.objectives, axis.id]);
  const matches = (value) => !query || `${value.code} ${value.title}`.toLocaleLowerCase('pt-BR').includes(query);
  const visibleObjectives = objectives.filter((objective) => matches(objective)
    || plan.items.some((item) => item.objectiveId === objective.id && (matches(item) || item.actions.some(matches))));
  // Durante a busca, os resultados ficam abertos para aparecerem sem cliques extras.
  const isExpanded = (id) => Boolean(query) || expanded.has(id);

  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const expandPath = () => setExpanded(new Set([context.objective?.id, context.item?.id].filter(Boolean)));
  const collapseAll = () => setExpanded(new Set());

  return <aside id="context-tree-navigation" className="context-tree" aria-label="Navegação do eixo" role={overlay ? 'dialog' : undefined} aria-modal={overlay ? 'true' : undefined}>
    <div className="context-tree-panel">
      <div className="context-tree-header">
        <div className="context-tree-header-label">
          <h2>{labels.axis} {axis.code}</h2>
          <span>{axis.name}</span>
        </div>
        <button type="button" className="br-button circle small context-tree-close" aria-label="Fechar navegação do eixo" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="context-tree-search"><Input label="Buscar no eixo" type="search" placeholder="Código ou nome…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="context-tree-actions">
        <button type="button" onClick={expandPath}>Abrir caminho atual</button>
        <button type="button" onClick={collapseAll}>Recolher tudo</button>
      </div>
      <div className="context-tree-scroll">
        <ul className="context-tree-list">
          {visibleObjectives.map((objective) => {
            const items = ordered(plan.items.filter((item) => item.objectiveId === objective.id))
              .filter((item) => matches(objective) || matches(item) || item.actions.some(matches));
            return <TreeNode key={objective.id} label={labels.objective} code={objective.code} title={objective.title} href={objectiveUrl(plan, objective)} active={context.objective?.id === objective.id && !context.item} expanded={isExpanded(objective.id)} onToggle={() => toggle(objective.id)} hasChildren={items.length > 0} level={0}>
              <ul>{items.map((item) => {
                const actions = ordered(item.actions).filter((action) => matches(item) || matches(action));
                return <TreeNode key={item.id} label={labels.item} code={item.code} title={item.title} href={itemUrl(plan, item)} active={context.item?.id === item.id && !context.action} expanded={isExpanded(item.id)} onToggle={() => toggle(item.id)} hasChildren={actions.length > 0} level={1}>
                  <ul>{actions.map((action) => <TreeNode key={action.id} label="Ação" code={action.code} title={action.title} href={itemUrl(plan, item, 'acao', undefined, action.id)} active={context.action?.id === action.id} expanded={false} hasChildren={false} level={2} />)}</ul>
                </TreeNode>;
              })}</ul>
            </TreeNode>;
          })}
          {!visibleObjectives.length && <li className="context-tree-empty">Nenhum resultado encontrado.</li>}
        </ul>
      </div>
    </div>
  </aside>;
}
