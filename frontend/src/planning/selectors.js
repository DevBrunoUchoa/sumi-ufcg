import { executionProgress, executionStatus, normalize } from '../domain.js';

export const itemsForAxis = (plan, axisId) => plan.items.filter((item) => item.axisId === axisId);

// Counts and stage execution are separate from indicator achievement. These selectors
// also provide the data boundary for future visual summaries, without new API fields.
export function summarizeScope(items, objectiveCount) {
  const actions = items.flatMap((item) => item.actions);
  return { objectives: objectiveCount, items: items.length, actions: actions.length, execution: executionProgress({ actions }) };
}

export function filterAxisItems(plan, axisId, { search = '', owner = '', status = '', objectiveId = '' } = {}) {
  const objectives = new Map(plan.objectives.map((objective) => [objective.id, objective]));
  return itemsForAxis(plan, axisId).filter((item) => {
    const objective = objectives.get(item.objectiveId);
    return (!objectiveId || item.objectiveId === objectiveId)
      && (!owner || item.owner === owner)
      && (!status || executionStatus(item) === status)
      && normalize(`${item.code} ${item.title} ${objective?.code || ''} ${objective?.title || ''}`).includes(normalize(search));
  });
}

export function filterAxes(plan, search) {
  const query = normalize(search);
  if (!query) return plan.axes;
  return plan.axes.filter((axis) => normalize(`${axis.code} ${axis.name} ${axis.ownerUnit}`).includes(query)
    || plan.objectives.some((objective) => objective.axisId === axis.id && normalize(`${objective.code} ${objective.title}`).includes(query))
    || itemsForAxis(plan, axis.id).some((item) => normalize(`${item.code} ${item.title}`).includes(query)));
}
