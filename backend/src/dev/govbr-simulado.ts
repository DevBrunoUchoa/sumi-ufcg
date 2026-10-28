/**
 * GOV.BR simulado — provedor OpenID Connect local, SÓ para desenvolvimento e
 * testes do login com GOV.BR sem credenciais reais. Segue o mesmo protocolo
 * do Login Único: discovery, authorization code + PKCE (S256), autenticação
 * do cliente por client_secret_basic e ID token RS256 com o CPF no `sub`.
 *
 * Usado por `pnpm --filter backend govbr-simulado` (scripts/govbr-simulado.ts)
 * e pelos testes do fluxo (modules/auth/govbr.routes.test.ts). Nenhuma rota do
 * app o importa.
 */
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface PessoaGovbr {
  nome: string;
  cpf: string;
  email: string;
  emailVerificado: boolean;
}

export const PESSOAS_PADRAO: PessoaGovbr[] = [
  { nome: "Maria da Silva", cpf: "52998224725", email: "maria.silva@exemplo.com", emailVerificado: true },
  { nome: "João Pereira", cpf: "11144477735", email: "joao.pereira@ufcg.edu.br", emailVerificado: true },
  { nome: "Ana Souza", cpf: "12345678909", email: "ana.souza@exemplo.com", emailVerificado: true },
];

interface Codigo {
  pessoa: PessoaGovbr;
  clientId: string;
  redirectUri: string;
  nonce: string;
  desafio: string;
}

const base64url = (dados: Buffer | string) => Buffer.from(dados).toString("base64url");
const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function responder(res: ServerResponse, status: number, corpo: unknown, tipo = "application/json; charset=utf-8"): void {
  res.writeHead(status, { "Content-Type": tipo, "Cache-Control": "no-store" });
  res.end(typeof corpo === "string" ? corpo : JSON.stringify(corpo));
}

async function lerCorpo(req: IncomingMessage): Promise<URLSearchParams> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  return new URLSearchParams(Buffer.concat(partes).toString("utf8"));
}

export async function criarGovbrSimulado(opcoes: {
  porta?: number;
  clientId?: string;
  clientSecret?: string;
  pessoas?: PessoaGovbr[];
} = {}): Promise<{ issuer: string; servidor: Server; fechar: () => Promise<void> }> {
  const clientId = opcoes.clientId ?? "sumi-local";
  const clientSecret = opcoes.clientSecret ?? "segredo-local";
  const pessoas = opcoes.pessoas ?? PESSOAS_PADRAO;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = base64url(randomBytes(8));
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };
  const codigos = new Map<string, Codigo>();
  let issuer = "";

  function assinarIdToken(dados: Codigo): string {
    const agora = Math.floor(Date.now() / 1000);
    const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
    const corpo = base64url(JSON.stringify({
      iss: issuer,
      aud: dados.clientId,
      sub: dados.pessoa.cpf,
      name: dados.pessoa.nome,
      email: dados.pessoa.email,
      email_verified: dados.pessoa.emailVerificado,
      amr: ["passwd"],
      nonce: dados.nonce,
      iat: agora,
      exp: agora + 300,
    }));
    return `${cabecalho}.${corpo}.${base64url(sign("sha256", Buffer.from(`${cabecalho}.${corpo}`), privateKey))}`;
  }

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", issuer);
    try {
      if (req.method === "GET" && url.pathname === "/.well-known/openid-configuration") {
        responder(res, 200, {
          issuer,
          authorization_endpoint: `${issuer}authorize`,
          token_endpoint: `${issuer}token`,
          jwks_uri: `${issuer}jwk`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          scopes_supported: ["openid", "email", "profile"],
          token_endpoint_auth_methods_supported: ["client_secret_basic"],
          code_challenge_methods_supported: ["S256"],
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/jwk") {
        responder(res, 200, { keys: [jwk] });
        return;
      }

      if (req.method === "GET" && url.pathname === "/authorize") {
        const p = url.searchParams;
        const faltando = ["response_type", "client_id", "redirect_uri", "state", "nonce", "code_challenge"].filter((chave) => !p.get(chave));
        if (faltando.length || p.get("response_type") !== "code" || p.get("code_challenge_method") !== "S256" || p.get("client_id") !== clientId) {
          responder(res, 400, `Pedido de autorização inválido (${faltando.join(", ") || "parâmetros"}).`, "text/plain; charset=utf-8");
          return;
        }
        const escolher = (indice: number) => `/authorize/escolher?${new URLSearchParams({ ...Object.fromEntries(p), pessoa: String(indice) })}`;
        const cancelar = `${p.get("redirect_uri")}?${new URLSearchParams({ error: "access_denied", state: p.get("state") ?? "" })}`;
        responder(res, 200, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>GOV.BR simulado</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1b1b1b}h1{color:#1351b4;font-size:1.4rem}
.aviso{background:#fff5c2;padding:.6rem .8rem;border-radius:4px}a.pessoa{display:block;margin:.6rem 0;padding:.8rem 1rem;border:1px solid #1351b4;border-radius:999px;color:#1351b4;text-decoration:none}
a.pessoa:hover{background:#1351b4;color:#fff}small{display:block;color:#555}a.cancelar{color:#555}</style></head><body>
<h1>GOV.BR simulado</h1><p class="aviso">Ambiente de desenvolvimento: nenhuma conta GOV.BR real é usada.</p><p>Entrar como:</p>
${pessoas.map((pessoa, i) => `<a class="pessoa" href="${escapar(escolher(i))}">${escapar(pessoa.nome)}<small>CPF ${escapar(pessoa.cpf)} · ${escapar(pessoa.email)}</small></a>`).join("\n")}
<p><a class="cancelar" href="${escapar(cancelar)}">Cancelar</a></p></body></html>`, "text/html; charset=utf-8");
        return;
      }

      if (req.method === "GET" && url.pathname === "/authorize/escolher") {
        const p = url.searchParams;
        const pessoa = pessoas[Number(p.get("pessoa"))];
        const redirectUri = p.get("redirect_uri");
        if (!pessoa || !redirectUri || p.get("client_id") !== clientId) {
          responder(res, 400, "Escolha inválida.", "text/plain; charset=utf-8");
          return;
        }
        const codigo = base64url(randomBytes(24));
        codigos.set(codigo, { pessoa, clientId, redirectUri, nonce: p.get("nonce") ?? "", desafio: p.get("code_challenge") ?? "" });
        res.writeHead(302, { Location: `${redirectUri}?${new URLSearchParams({ code: codigo, state: p.get("state") ?? "" })}` });
        res.end();
        return;
      }

      if (req.method === "POST" && url.pathname === "/token") {
        const [esquema, credenciais] = (req.headers.authorization ?? "").split(" ");
        const [id, segredo] = Buffer.from(credenciais ?? "", "base64").toString("utf8").split(":").map(decodeURIComponent);
        if (esquema !== "Basic" || id !== clientId || segredo !== clientSecret) {
          responder(res, 401, { error: "invalid_client" });
          return;
        }
        const corpo = await lerCorpo(req);
        const dados = codigos.get(corpo.get("code") ?? "");
        codigos.delete(corpo.get("code") ?? "");
        const verificador = corpo.get("code_verifier") ?? "";
        if (
          corpo.get("grant_type") !== "authorization_code" ||
          !dados ||
          corpo.get("redirect_uri") !== dados.redirectUri ||
          base64url(createHash("sha256").update(verificador).digest()) !== dados.desafio
        ) {
          responder(res, 400, { error: "invalid_grant" });
          return;
        }
        responder(res, 200, { access_token: base64url(randomBytes(24)), token_type: "Bearer", expires_in: 300, id_token: assinarIdToken(dados) });
        return;
      }

      responder(res, 404, { error: "not_found" });
    } catch (erro) {
      responder(res, 500, { error: "server_error", message: String(erro) });
    }
  });

  await new Promise<void>((resolve) => servidor.listen(opcoes.porta ?? 0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/`;
  return { issuer, servidor, fechar: () => new Promise((resolve) => servidor.close(() => resolve())) };
}
