import { describe, expect, it } from "vitest";
import { cpfValido, normalizarCpf } from "./cpf.js";

describe("cpf", () => {
  it("normaliza tirando pontuação", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizarCpf(" 111 444 777 35 ")).toBe("11144477735");
  });

  it("aceita CPFs com dígitos verificadores corretos", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
    expect(cpfValido("12345678909")).toBe(true);
  });

  it("recusa dígito verificador errado, tamanho errado e dígitos todos iguais", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("529.982.247-25")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
});
