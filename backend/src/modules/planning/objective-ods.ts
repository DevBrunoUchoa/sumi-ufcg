import type { Objective } from "./planning.types.js";

export function normalizeObjectiveOds(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 17))].sort((a, b) => a - b);
}

/** Clientes antigos omitem o campo: preservamos o cadastro, inclusive quando vazio. */
export function objectiveData(objective: Objective, previous?: Record<string, unknown>) {
  const ods = normalizeObjectiveOds(objective.ods ?? previous?.ods);
  return { code: objective.code, title: objective.title, ...(ods === undefined ? {} : { ods }) };
}
