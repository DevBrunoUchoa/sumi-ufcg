/**
 * Cria o bucket de storage "anexos" no Supabase (idempotente — não falha se
 * já existir). O bucket é privado: arquivos são servidos pelo backend via
 * signed URL de curta duração (ver planning/anexos.service.ts), respeitando
 * a mesma visibilidade (plan.read_internal) usada para riscos/histórico.
 *
 * Uso: pnpm --filter backend criar-bucket
 */
import { supabase } from "../src/lib/supabase.js";

const BUCKET = "anexos";
const LIMITE_TAMANHO_BYTES = 15 * 1024 * 1024; // 15MB
const TIPOS_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
];

async function main() {
  const { data: existentes, error: erroLista } = await supabase.storage.listBuckets();
  if (erroLista) throw erroLista;

  if (existentes?.some((b) => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" já existe.`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: LIMITE_TAMANHO_BYTES,
    allowedMimeTypes: TIPOS_PERMITIDOS,
  });
  if (error) throw error;
  console.log(`Bucket "${BUCKET}" criado (privado, limite ${LIMITE_TAMANHO_BYTES / 1024 / 1024}MB).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
