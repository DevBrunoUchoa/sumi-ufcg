import { describe, expect, it } from "vitest";
import { normalizeObjectiveOds, objectiveData } from "./objective-ods.js";

const objective = { id: "o1", axisId: "a1", code: "1.1", title: "Objetivo" };

describe("compatibilidade dos vínculos ODS", () => {
  it("não inventa campo em objetivos legados", () => {
    expect(objectiveData(objective, { code: "1.1", title: "Objetivo" })).toEqual({ code: "1.1", title: "Objetivo" });
    expect(normalizeObjectiveOds(undefined)).toBeUndefined();
  });
  it("preserva o cadastro omitido por um cliente antigo, inclusive vazio", () => {
    expect(objectiveData(objective, { ods: [4, 16] }).ods).toEqual([4, 16]);
    expect(objectiveData(objective, { ods: [] }).ods).toEqual([]);
  });
  it("respeita a escolha explícita e normaliza somente números inteiros válidos", () => {
    expect(objectiveData({ ...objective, ods: [] }, { ods: [4, 16] }).ods).toEqual([]);
    expect(normalizeObjectiveOds([16, 4, 4, 0, 18, 4.5, "8"])).toEqual([4, 16]);
  });
});
