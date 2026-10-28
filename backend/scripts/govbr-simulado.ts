/**
 * GOV.BR simulado para desenvolvimento — ver src/dev/govbr-simulado.ts.
 *
 * Uso:
 *   pnpm --filter backend govbr-simulado
 * e, no backend/.env:
 *   GOVBR_ISSUER=http://127.0.0.1:4400
 *   GOVBR_CLIENT_ID=sumi-local
 *   GOVBR_CLIENT_SECRET=segredo-local
 *
 * As pessoas de teste podem ser trocadas por GOVBR_SIMULADO_PESSOAS (JSON:
 * [{ "nome", "cpf", "email", "emailVerificado" }]).
 */
import { criarGovbrSimulado, type PessoaGovbr } from "../src/dev/govbr-simulado.js";

const pessoas = process.env.GOVBR_SIMULADO_PESSOAS ? (JSON.parse(process.env.GOVBR_SIMULADO_PESSOAS) as PessoaGovbr[]) : undefined;
const { issuer } = await criarGovbrSimulado({
  porta: Number(process.env.GOVBR_SIMULADO_PORTA ?? 4400),
  clientId: process.env.GOVBR_CLIENT_ID,
  clientSecret: process.env.GOVBR_CLIENT_SECRET,
  pessoas,
});
console.log(`GOV.BR simulado em ${issuer} (só para desenvolvimento).`);
