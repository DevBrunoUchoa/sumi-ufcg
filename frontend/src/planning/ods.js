import reference from './pdi-ods-reference.json' with { type: 'json' };

const normalizedTitle = (value) => String(value ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const ODS_GOALS = reference.icons;

export function odsForObjective(plan, objective) {
  if (!objective) return [];
  if (Array.isArray(objective.ods)) return ODS_GOALS.filter((icon) => objective.ods.includes(icon.id));
  return documentedOdsForObjective(plan, objective);
}

// These are documented links for this PDI, not defaults for new objectives.
// Matching the title also supports the existing import with a title in `code`.
export function documentedOdsForObjective(plan, objective) {
  if (!objective || plan.type !== 'PDI' || Number(plan.start) !== 2026 || Number(plan.end) !== 2030) return [];
  const axis = plan.axes.find((entry) => entry.id === objective.axisId);
  const axisCode = String(axis?.code ?? '').trim().replace(/^0+(?=\d)/, '');
  const documented = reference.objectives.find((entry) => entry.code.split('.')[0] === axisCode
    && [entry.title, ...(entry.aliases || [])].some((title) => normalizedTitle(title) === normalizedTitle(objective.title)));
  if (!documented) return [];
  return reference.icons.filter((icon) => documented.ods.includes(icon.id));
}
