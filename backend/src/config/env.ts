import "dotenv/config";
import { z } from "zod";

// Variáveis vindas de um .env/compose costumam chegar vazias ("CHAVE=") em
// vez de ausentes — tratadas como não definidas.
const opcional = <T extends z.ZodType>(schema: T) => z.preprocess((valor) => (valor === "" ? undefined : valor), schema.optional());

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
  // Login com GOV.BR (Login Único, OIDC) — opcional, liga só com as três
  // primeiras definidas (ver modules/auth/govbr.ts). GOVBR_ISSUER é
  // https://sso.staging.acesso.gov.br em homologação e
  // https://sso.acesso.gov.br em produção. GOVBR_REDIRECT_URI precisa ser
  // exatamente a URL de retorno cadastrada no GOV.BR; o padrão é
  // FRONTEND_URL + /api/v1/auth/govbr/callback.
  GOVBR_ISSUER: opcional(z.string().url()),
  GOVBR_CLIENT_ID: opcional(z.string()),
  GOVBR_CLIENT_SECRET: opcional(z.string()),
  GOVBR_REDIRECT_URI: opcional(z.string().url()),
}).superRefine((valores, ctx) => {
  const govbr = [valores.GOVBR_ISSUER, valores.GOVBR_CLIENT_ID, valores.GOVBR_CLIENT_SECRET];
  if (govbr.some(Boolean) && !govbr.every(Boolean)) {
    ctx.addIssue({
      code: "custom",
      path: ["GOVBR_ISSUER"],
      message: "Para o login com GOV.BR, defina GOVBR_ISSUER, GOVBR_CLIENT_ID e GOVBR_CLIENT_SECRET juntas",
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Falha ao carregar configuração de ambiente");
}

export const env = parsed.data;
