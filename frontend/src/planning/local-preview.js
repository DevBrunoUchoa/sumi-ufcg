// Migração exclusiva da fonte local; a API HTTP nunca passa por esta função.
// A revisão fica no próprio workspace: exclusões e alterações posteriores não
// são desfeitas por um reload, nem por uma regeneração idêntica da carga.
const comparable = (item) => JSON.stringify({ ...item, history: item.history.map((entry) => ({ ...entry, id: undefined })) });

export function mergeLocalPreview(current, incoming, baseline) {
  if (!incoming.localPreview?.revision || current.localPreview?.revision === incoming.localPreview.revision) return current;
  const result = structuredClone(current);
  const seed = structuredClone(incoming.plans.find((plan) => plan.id === 'pdi' && plan.type === 'PDI'));
  const plan = result.plans.find((plan) => plan.id === 'pdi' && plan.type === 'PDI');
  if (!seed || !plan) return current;
  const original = baseline.plans.find((plan) => plan.id === 'pdi');
  const axes = new Map();
  for (const axis of seed.axes) {
    const existing = plan.axes.find((a) => a.code === axis.code);
    axes.set(axis.id, existing?.id || axis.id);
    if (!existing) plan.axes.push(axis);
    else if (existing.ownerUnit === 'A definir' || existing.ownerUnit === original.axes.find((a) => a.code === axis.code)?.ownerUnit) existing.ownerUnit = axis.ownerUnit;
  }
  const objectives = new Map();
  for (const objective of seed.objectives) {
    objective.axisId = axes.get(objective.axisId);
    const existing = plan.objectives.find((o) => o.axisId === objective.axisId && o.code === objective.code);
    objectives.set(objective.id, existing?.id || objective.id);
    if (!existing) plan.objectives.push(objective);
  }
  for (const item of seed.items) {
    item.axisId = axes.get(item.axisId);
    item.objectiveId = objectives.get(item.objectiveId);
    const index = plan.items.findIndex((existing) => existing.axisId === item.axisId && existing.code === item.code);
    if (index < 0) plan.items.push(item);
    else {
      const base = original.items.find((existing) => existing.code === item.code);
      // Substitui os antigos exemplos intactos. Edições do usuário prevalecem.
      if (base && comparable(plan.items[index]) === comparable(base)) plan.items[index] = item;
    }
  }
  plan.items.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
  plan.localPreview = incoming.localPreview;
  result.localPreview = incoming.localPreview;
  return result;
}
