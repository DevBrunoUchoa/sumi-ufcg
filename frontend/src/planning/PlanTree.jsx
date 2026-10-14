import { useEffect, useState } from 'react';
import { Icon } from '../ui.jsx';
import { AxisIcon } from '../AxisIcon.jsx';
import { ordered } from './selectors.js';
import { axisUrl, itemUrl, objectiveCode, objectiveUrl } from './navigation.js';

// Resumo curto pra não estourar a largura da árvore lateral — o título
// completo continua disponível no atributo title (hover) e no texto real do
// link (leitor de tela lê tudo, a truncagem é só visual via CSS).
const shorten = (text, max = 30) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function PlanTree({ plan, axis: currentAxis, objective: currentObjective, item: currentItem, action: currentAction, stage: currentStage }) {
  const [expanded, setExpanded] = useState(() => new Set());
  // Garante que o caminho até a posição atual sempre esteja expandido,
  // mesmo navegando entre eixos sem remontar o componente — só adiciona,
  // nunca recolhe o que a pessoa já abriu manualmente em outro ramo.
  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      if (currentAxis) next.add(`axis:${currentAxis.id}`);
      if (currentObjective) next.add(`objective:${currentObjective.id}`);
      if (currentItem) next.add(`item:${currentItem.id}`);
      if (currentAction) next.add(`action:${currentAction.id}`);
      return next;
    });
  }, [currentAxis?.id, currentObjective?.id, currentItem?.id, currentAction?.id]);
  const toggle = (key) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const axisIsCurrent = (axis) => currentAxis?.id === axis.id && !currentObjective;
  const axisIsAncestor = (axis) => currentAxis?.id === axis.id && !!currentObjective;
  const objectiveIsCurrent = (objective) => currentObjective?.id === objective.id && !currentItem;
  const objectiveIsAncestor = (objective) => currentObjective?.id === objective.id && !!currentItem;
  const itemIsCurrent = (item) => currentItem?.id === item.id && !currentAction;
  const itemIsAncestor = (item) => currentItem?.id === item.id && !!currentAction;
  const actionIsCurrent = (action) => currentAction?.id === action.id && !currentStage;
  const actionIsAncestor = (action) => currentAction?.id === action.id && !!currentStage;
  const stageIsCurrent = (stage) => currentStage?.id === stage.id;
  const stateClass = (isCurrent, isAncestor) => isCurrent ? 'current' : isAncestor ? 'ancestor' : '';

  return <aside className="plan-tree pdi-plan-tree" aria-label="Estrutura do plano">
    <div className="tree-heading"><h2>Estrutura do plano</h2></div>
    <nav className="tree-content" aria-label="Eixos, objetivos, iniciativas, ações e etapas">
      {ordered(plan.axes).map((axis) => {
        const axisKey = `axis:${axis.id}`;
        const axisObjectives = ordered(plan.objectives.filter((entry) => entry.axisId === axis.id));
        return <div key={axis.id} className="axis-group" style={{ '--axis-color': axis.color }}>
          <div className="tree-item-row">
            <button type="button" className="tree-expand" aria-label={`${expanded.has(axisKey) ? 'Recolher' : 'Expandir'} eixo ${axis.code}`} aria-expanded={expanded.has(axisKey)} onClick={() => toggle(axisKey)}>
              <Icon name="chevron" size={12} className={expanded.has(axisKey) ? 'rotated' : ''} />
            </button>
            <a href={`#${axisUrl(plan, axis)}`} className={`tree-group axis ${stateClass(axisIsCurrent(axis), axisIsAncestor(axis))}`} aria-current={axisIsCurrent(axis) ? 'page' : undefined} title={axis.name}>
              <AxisIcon planType={plan.type} axis={axis} /><span>Eixo {axis.code} · {shorten(axis.name)}</span>
            </a>
          </div>
          {expanded.has(axisKey) && axisObjectives.map((objective) => {
            const objectiveKey = `objective:${objective.id}`;
            const objectiveItems = ordered(plan.items.filter((entry) => entry.objectiveId === objective.id));
            return <div className="objective-group" key={objective.id}>
              <div className="tree-item-row">
                <button type="button" className="tree-expand" aria-label={`${expanded.has(objectiveKey) ? 'Recolher' : 'Expandir'} objetivo ${objectiveCode(objective)}`} aria-expanded={expanded.has(objectiveKey)} onClick={() => toggle(objectiveKey)}>
                  <Icon name="chevron" size={12} className={expanded.has(objectiveKey) ? 'rotated' : ''} />
                </button>
                <a href={`#${objectiveUrl(plan, objective)}`} className={`tree-group objective ${stateClass(objectiveIsCurrent(objective), objectiveIsAncestor(objective))}`} aria-current={objectiveIsCurrent(objective) ? 'page' : undefined} title={objective.title}>
                  <span>{objectiveCode(objective)} · {shorten(objective.title, 26)}</span>
                </a>
              </div>
              {expanded.has(objectiveKey) && objectiveItems.map((item) => {
                const itemKey = `item:${item.id}`;
                return <div className="initiative-group" key={item.id}>
                  <div className="tree-item-row">
                    <button type="button" className="tree-expand" aria-label={`${expanded.has(itemKey) ? 'Recolher' : 'Expandir'} ações de ${item.code}`} aria-expanded={expanded.has(itemKey)} onClick={() => toggle(itemKey)}>
                      <Icon name="chevron" size={12} className={expanded.has(itemKey) ? 'rotated' : ''} />
                    </button>
                    <a href={`#${itemUrl(plan, item)}`} className={`tree-item ${stateClass(itemIsCurrent(item), itemIsAncestor(item))}`} aria-current={itemIsCurrent(item) ? 'page' : undefined} title={item.title}>
                      <small>{item.code}</small>{shorten(item.title, 26)}
                    </a>
                  </div>
                  {expanded.has(itemKey) && <div className="action-tree">
                    {item.actions.map((action) => {
                      const actionKey = `action:${action.id}`;
                      return <div key={action.id}>
                        <div className="tree-item-row">
                          <button type="button" className="tree-expand" aria-label={`${expanded.has(actionKey) ? 'Recolher' : 'Expandir'} etapas da ação ${action.code}`} aria-expanded={expanded.has(actionKey)} onClick={() => toggle(actionKey)}>
                            <Icon name="chevron" size={12} className={expanded.has(actionKey) ? 'rotated' : ''} />
                          </button>
                          <a href={`#${itemUrl(plan, item, 'acao', undefined, action.id)}`} className={`tree-action ${stateClass(actionIsCurrent(action), actionIsAncestor(action))}`} aria-current={actionIsCurrent(action) ? 'page' : undefined} title={action.title}>
                            <small>Ação {action.code}</small>{shorten(action.title, 24)}
                          </a>
                        </div>
                        {expanded.has(actionKey) && !!action.tasks.length && <div className="stage-tree">
                          {action.tasks.map((stage) => (
                            <a key={stage.id} href={`#${itemUrl(plan, item, 'riscos', undefined, action.id, stage.id)}`} className={`tree-stage ${stageIsCurrent(stage) ? 'current' : ''}`} aria-current={stageIsCurrent(stage) ? 'page' : undefined} title={stage.title}>
                              {shorten(stage.title, 22)}
                            </a>
                          ))}
                        </div>}
                      </div>;
                    })}
                    {!item.actions.length && <p className="tree-no-results">Nenhuma ação cadastrada.</p>}
                  </div>}
                </div>;
              })}
            </div>;
          })}
        </div>;
      })}
    </nav>
  </aside>;
}
