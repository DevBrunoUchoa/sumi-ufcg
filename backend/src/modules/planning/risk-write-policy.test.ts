import { describe, expect, it } from "vitest";
import { prepareRiskWrite } from "./risk-write-policy.js";

const existing = [{ actionId: "action", title: "Risco restrito", probability: 3 }];
const input = { existing, submitted: [] as typeof existing, canRead: false, canManage: false, changed: true, actionIds: new Set(["action"]), itemCode: "8.1.1" };
describe("risco ocultado no round-trip do workspace", () => {
  it("preserva o risco e o vínculo à ação ao salvar uma etapa sem acesso a riscos", () => {
    expect(prepareRiskWrite(input)).toEqual(existing);
  });
  it("não permite excluir uma ação cujo risco está oculto", () => {
    expect(() => prepareRiskWrite({ ...input, actionIds: new Set() })).toThrow(/remover ações/);
  });
  it("nega alteração ou exclusão explícita sem risk.manage", () => {
    expect(() => prepareRiskWrite({ ...input, submitted: [{ ...existing[0]!, probability: 5 }] })).toThrow(/Sem permissão/);
    expect(() => prepareRiskWrite({ ...input, canRead: true })).toThrow(/Sem permissão/);
  });
  it("permite alteração explícita com leitura e gestão de riscos", () => {
    const submitted = [{ ...existing[0]!, probability: 5 }];
    expect(prepareRiskWrite({ ...input, submitted, canRead: true, canManage: true })).toEqual(submitted);
  });
});
