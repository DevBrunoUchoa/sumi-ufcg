import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL precisa ser uma URL válida" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY é obrigatório"),
  // URL pública do frontend — usada para montar links em e-mails (ex.:
  // redefinição de senha). Tem um padrão razoável porque e-mail é opcional
  // (ver SMTP_HOST abaixo): sem SMTP configurado, nada é enviado de fato.
  FRONTEND_URL: z.string().url().default("https://sumi-ufcg.netlify.app"),
  // Envio de e-mail (redefinição de senha, notificações) — opcional. Sem
  // SMTP_HOST, o mailer só registra no log em vez de enviar (ver
  // lib/mailer.ts) — a aplicação funciona normalmente sem provedor de
  // e-mail configurado, até a coordenação definir um.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Falha ao carregar configuração de ambiente");
}

export const env = parsed.data;
