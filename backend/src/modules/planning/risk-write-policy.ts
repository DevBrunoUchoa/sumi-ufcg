import { HttpError } from "../../lib/http-error.js";

export function prepareRiskWrite<T extends { actionId: unknown }>({ existing, submitted, canRead, canManage, changed, actionIds, itemCode }: {
  existing: T[]; submitted: T[]; canRead: boolean; canManage: boolean;
  changed: boolean; actionIds: Set<string>; itemCode: string;
}): T[] {
  // GET redacts risks to [] without risk.read. That empty list is not a deletion.
  if (!canRead && submitted.length === 0) {
    if (existing.some((risk) => typeof risk.actionId === "string" && !actionIds.has(risk.actionId))) {
      throw new HttpError(403, `Não é possível remover ações com riscos não visíveis no item "${itemCode}"`);
    }
    return existing;
  }
  if (changed && !canManage) throw new HttpError(403, `Sem permissão para alterar riscos do item "${itemCode}"`);
  return submitted;
}
