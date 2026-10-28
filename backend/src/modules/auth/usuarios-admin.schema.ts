import { z } from "zod";
import { cpfValido, normalizarCpf } from "../../lib/cpf.js";
import { HttpError } from "../../lib/http-error.js";

// Aceita com ou sem pontuação; guarda só os dígitos (é o `sub` do GOV.BR).
const cpfSchema = z.string().trim().transform(normalizarCpf).refine(cpfValido, "CPF inválido");

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email(),
  senha: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres"),
  papelAdmin: z.boolean().default(false),
  cpf: z.preprocess((valor) => (valor === "" ? undefined : valor), cpfSchema.optional()),
});

export const atualizarUsuarioSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  papelAdmin: z.boolean().optional(),
  senha: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres").optional(),
  // "" ou null desliga a conta do GOV.BR; ausente mantém como está.
  cpf: z.preprocess((valor) => (valor === "" ? null : valor), cpfSchema.nullable().optional()),
});

export function parseOrLancar<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw new HttpError(400, "Dados inválidos", resultado.error.flatten());
  }
  return resultado.data;
}
