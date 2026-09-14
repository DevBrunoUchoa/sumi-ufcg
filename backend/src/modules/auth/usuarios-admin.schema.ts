import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";

export const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email(),
  senha: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres"),
  papelAdmin: z.boolean().default(false),
});

export const atualizarUsuarioSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  papelAdmin: z.boolean().optional(),
  senha: z.string().min(8, "a senha precisa ter pelo menos 8 caracteres").optional(),
});

export function parseOrLancar<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw new HttpError(400, "Dados inválidos", resultado.error.flatten());
  }
  return resultado.data;
}
