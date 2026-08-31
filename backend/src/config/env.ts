import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL precisa ser uma URL válida" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY é obrigatório"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Falha ao carregar configuração de ambiente");
}

export const env = parsed.data;
