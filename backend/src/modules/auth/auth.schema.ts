import { z } from "zod";
import { HttpError } from "../../lib/http-error.js";

export const loginSchema = z.object({
  email: z.string().trim().email("informe um e-mail válido"),
  senha: z.string().min(1, "informe a senha"),
});

export function parseOrLancar<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw new HttpError(400, "Dados inválidos", resultado.error.flatten());
  }
  return resultado.data;
}
