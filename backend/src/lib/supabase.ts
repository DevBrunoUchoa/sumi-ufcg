import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

/**
 * Cliente Supabase server-side, autenticado com a service role key.
 *
 * NUNCA reexportar/expor este cliente (ou a chave) para código que roda no
 * navegador — ele ignora Row Level Security e tem acesso administrativo
 * completo ao banco. Uso exclusivo do backend.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
