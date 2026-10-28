import * as oidc from "openid-client";
import { env } from "../../config/env.js";

/**
 * Login com GOV.BR (Login Único): OpenID Connect com authorization code +
 * PKCE, via openid-client. O SUMI nunca vê a senha GOV.BR — o navegador vai
 * ao GOV.BR, volta ao callback com um código, e o backend troca o código pelo
 * ID token (CPF no `sub`, nome e e-mail). As credenciais ficam só no servidor
 * (config/env.ts); sem elas, o login com GOV.BR fica desligado.
 */

export const GOVBR_CALLBACK_PATH = "/api/v1/auth/govbr/callback";
const ESCOPOS = "openid email profile";

/** Guardado num cookie entre a ida ao GOV.BR e o callback (ver govbr.routes.ts). */
export interface FluxoGovbr {
  estado: string;
  nonce: string;
  verificador: string;
  retorno: string;
}

export interface IdentidadeGovbr {
  cpf: string;
  nome: string | null;
  email: string | null;
  emailVerificado: boolean;
}

export function govbrHabilitado(): boolean {
  return Boolean(env.GOVBR_ISSUER && env.GOVBR_CLIENT_ID && env.GOVBR_CLIENT_SECRET);
}

/** Precisa ser idêntica à URL de retorno cadastrada no GOV.BR. */
export function urlDeRetornoGovbr(): string {
  return env.GOVBR_REDIRECT_URI ?? `${env.FRONTEND_URL.replace(/\/$/, "")}${GOVBR_CALLBACK_PATH}`;
}

let configuracao: Promise<oidc.Configuration> | null = null;

/** Discovery do provedor, feito uma vez por processo (e refeito se falhar). */
function obterConfiguracao(): Promise<oidc.Configuration> {
  const { GOVBR_ISSUER, GOVBR_CLIENT_ID, GOVBR_CLIENT_SECRET } = env;
  if (!GOVBR_ISSUER || !GOVBR_CLIENT_ID || !GOVBR_CLIENT_SECRET) {
    return Promise.reject(new Error("Login com GOV.BR não configurado"));
  }
  const issuer = new URL(GOVBR_ISSUER);
  configuracao ??= oidc
    .discovery(issuer, GOVBR_CLIENT_ID, undefined, oidc.ClientSecretBasic(GOVBR_CLIENT_SECRET), {
      // http só é aceito para o GOV.BR simulado local (backend/scripts/govbr-simulado.ts).
      execute: issuer.protocol === "http:" ? [oidc.allowInsecureRequests] : [],
    })
    .catch((erro: unknown) => {
      configuracao = null;
      throw erro;
    });
  return configuracao;
}

export async function iniciarFluxoGovbr(retorno: string): Promise<{ url: URL; fluxo: FluxoGovbr }> {
  const config = await obterConfiguracao();
  const fluxo: FluxoGovbr = {
    estado: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verificador: oidc.randomPKCECodeVerifier(),
    retorno,
  };
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: urlDeRetornoGovbr(),
    scope: ESCOPOS,
    state: fluxo.estado,
    nonce: fluxo.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(fluxo.verificador),
    code_challenge_method: "S256",
  });
  return { url, fluxo };
}

/**
 * `query` é a query string recebida no callback (com o "?"). A URL atual é
 * montada sobre a URL de retorno configurada, não sobre o Host da requisição:
 * atrás do proxy da STI o backend recebe http, e o redirect_uri enviado na
 * troca do código precisa ser idêntico ao da ida.
 */
export async function concluirFluxoGovbr(query: string, fluxo: FluxoGovbr): Promise<IdentidadeGovbr> {
  const config = await obterConfiguracao();
  const atual = new URL(urlDeRetornoGovbr());
  atual.search = query;
  const tokens = await oidc.authorizationCodeGrant(config, atual, {
    expectedState: fluxo.estado,
    expectedNonce: fluxo.nonce,
    pkceCodeVerifier: fluxo.verificador,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub) throw new Error("ID token do GOV.BR sem CPF (sub)");
  return {
    cpf: claims.sub,
    nome: typeof claims.name === "string" ? claims.name : null,
    email: typeof claims.email === "string" ? claims.email : null,
    emailVerificado: claims.email_verified === true,
  };
}
