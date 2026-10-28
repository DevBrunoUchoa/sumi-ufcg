import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { criarGovbrSimulado, PESSOAS_PADRAO } from "../../dev/govbr-simulado.js";
import type { Usuario } from "./auth.types.js";

// O fluxo roda de ponta a ponta: app de verdade, openid-client de verdade
// (discovery, PKCE, validação do ID token) e o GOV.BR simulado. Só o banco é
// fake.
const repo = vi.hoisted(() => ({
  buscarPorCpf: vi.fn(),
  buscarPorEmail: vi.fn(),
  atualizar: vi.fn(),
  criarSessao: vi.fn(),
}));

vi.mock("./auth.repository.js", () => ({
  usuarioRepository: { buscarPorCpf: repo.buscarPorCpf, buscarPorEmail: repo.buscarPorEmail, atualizar: repo.atualizar },
  sessaoRepository: { criar: repo.criarSessao, buscarUsuarioIdValido: vi.fn().mockResolvedValue(null), remover: vi.fn() },
  eixoRepository: { listarTodos: vi.fn().mockResolvedValue([]) },
  redefinicaoSenhaRepository: {},
}));

const FRONTEND = "http://localhost:5555";
const [maria, joao, ana] = PESSOAS_PADRAO;

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: "u1",
    nome: "Usuário",
    email: "usuario@ufcg.edu.br",
    senhaHash: "x",
    papelAdmin: false,
    cpf: null,
    criadoEm: "",
    atualizadoEm: "",
    ...overrides,
  };
}

let simulado: Awaited<ReturnType<typeof criarGovbrSimulado>>;
let servidor: Server;
let app: string;

beforeAll(async () => {
  simulado = await criarGovbrSimulado();
  process.env.FRONTEND_URL = FRONTEND;
  process.env.GOVBR_ISSUER = simulado.issuer;
  process.env.GOVBR_CLIENT_ID = "sumi-local";
  process.env.GOVBR_CLIENT_SECRET = "segredo-local";
  vi.resetModules();
  const { createApp } = await import("../../app.js");
  servidor = createApp().listen(0);
  app = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}, 60_000); // importar o app inteiro (Express, ExcelJS, Supabase…) passa de 10 s em máquina lenta

afterAll(async () => {
  await new Promise((resolve) => servidor?.close(resolve));
  await simulado?.fechar();
  for (const chave of ["FRONTEND_URL", "GOVBR_ISSUER", "GOVBR_CLIENT_ID", "GOVBR_CLIENT_SECRET"]) delete process.env[chave];
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.criarSessao.mockResolvedValue("token-sessao");
});

/** Ida ao GOV.BR, escolha da pessoa no simulado e volta ao callback. */
async function entrarComo(pessoa: number | "cancelar", ajustar?: (volta: URL) => void, returnTo = "/plano/p1") {
  const ida = await fetch(`${app}/api/v1/auth/govbr/authorize?${new URLSearchParams({ returnTo })}`, { redirect: "manual" });
  expect(ida.status).toBe(302);
  const cookieFluxo = ida.headers.getSetCookie().find((c) => c.startsWith("sumi_govbr="))!.split(";")[0]!;
  const autorizacao = new URL(ida.headers.get("location")!);
  expect(autorizacao.href.startsWith(`${simulado.issuer}authorize?`)).toBe(true);

  let volta: URL;
  if (pessoa === "cancelar") {
    volta = new URL(autorizacao.searchParams.get("redirect_uri")!);
    volta.search = new URLSearchParams({ error: "access_denied", state: autorizacao.searchParams.get("state")! }).toString();
  } else {
    const escolha = new URL("/authorize/escolher", simulado.issuer);
    escolha.search = autorizacao.search;
    escolha.searchParams.set("pessoa", String(pessoa));
    volta = new URL((await fetch(escolha, { redirect: "manual" })).headers.get("location")!);
  }
  ajustar?.(volta);
  return fetch(`${app}${volta.pathname}${volta.search}`, { redirect: "manual", headers: { cookie: cookieFluxo } });
}

const sessaoCriada = (res: Response) => res.headers.getSetCookie().some((c) => c.startsWith("sumi_session=token-sessao"));

describe("login com GOV.BR", () => {
  it("informa ao frontend que o login está habilitado", async () => {
    expect(await (await fetch(`${app}/api/v1/auth/govbr`)).json()).toEqual({ enabled: true });
  });

  it("pede code + PKCE S256 com a URL de retorno padrão (FRONTEND_URL + callback)", async () => {
    const ida = await fetch(`${app}/api/v1/auth/govbr/authorize`, { redirect: "manual" });
    const autorizacao = new URL(ida.headers.get("location")!);
    expect(autorizacao.searchParams.get("response_type")).toBe("code");
    expect(autorizacao.searchParams.get("code_challenge_method")).toBe("S256");
    expect(autorizacao.searchParams.get("scope")).toBe("openid email profile");
    expect(autorizacao.searchParams.get("redirect_uri")).toBe(`${FRONTEND}/api/v1/auth/govbr/callback`);
  });

  it("entra pelo CPF já cadastrado e volta para a página de origem", async () => {
    repo.buscarPorCpf.mockResolvedValue(usuario({ cpf: maria!.cpf }));
    const res = await entrarComo(0);
    expect(res.headers.get("location")).toBe(`${FRONTEND}/#/plano/p1`);
    expect(sessaoCriada(res)).toBe(true);
    expect(repo.buscarPorCpf).toHaveBeenCalledWith(maria!.cpf);
    expect(repo.atualizar).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie().some((c) => c.startsWith("sumi_govbr=;"))).toBe(true);
  });

  it("no primeiro acesso, liga pelo e-mail verificado e grava o CPF", async () => {
    repo.buscarPorCpf.mockResolvedValue(null);
    repo.buscarPorEmail.mockResolvedValue(usuario({ id: "u-joao", email: joao!.email }));
    repo.atualizar.mockResolvedValue(usuario({ id: "u-joao", email: joao!.email, cpf: joao!.cpf }));
    const res = await entrarComo(1);
    expect(res.headers.get("location")).toBe(`${FRONTEND}/#/plano/p1`);
    expect(sessaoCriada(res)).toBe(true);
    expect(repo.buscarPorEmail).toHaveBeenCalledWith(joao!.email);
    expect(repo.atualizar).toHaveBeenCalledWith("u-joao", { cpf: joao!.cpf });
  });

  it("não entra quem não tem conta no SUMI", async () => {
    repo.buscarPorCpf.mockResolvedValue(null);
    repo.buscarPorEmail.mockResolvedValue(null);
    const res = await entrarComo(2);
    expect(res.headers.get("location")).toBe(`${FRONTEND}/#/login?govbr=nao-vinculado&returnTo=%2Fplano%2Fp1`);
    expect(sessaoCriada(res)).toBe(false);
    expect(repo.buscarPorEmail).toHaveBeenCalledWith(ana!.email);
  });

  it("não liga pelo e-mail quando a conta já tem outro CPF", async () => {
    repo.buscarPorCpf.mockResolvedValue(null);
    repo.buscarPorEmail.mockResolvedValue(usuario({ email: joao!.email, cpf: maria!.cpf }));
    const res = await entrarComo(1);
    expect(res.headers.get("location")).toContain("govbr=nao-vinculado");
    expect(repo.atualizar).not.toHaveBeenCalled();
    expect(sessaoCriada(res)).toBe(false);
  });

  it("volta ao login avisando quando a pessoa cancela no GOV.BR", async () => {
    const res = await entrarComo("cancelar");
    expect(res.headers.get("location")).toBe(`${FRONTEND}/#/login?govbr=cancelado&returnTo=%2Fplano%2Fp1`);
  });

  it("recusa um callback com state diferente do da ida", async () => {
    repo.buscarPorCpf.mockResolvedValue(usuario({ cpf: maria!.cpf }));
    const res = await entrarComo(0, (volta) => volta.searchParams.set("state", "outro-state"));
    expect(res.headers.get("location")).toContain("govbr=falha");
    expect(sessaoCriada(res)).toBe(false);
  });

  it("recusa um callback sem o cookie do fluxo", async () => {
    const res = await fetch(`${app}/api/v1/auth/govbr/callback?code=abc&state=xyz`, { redirect: "manual" });
    expect(res.headers.get("location")).toBe(`${FRONTEND}/#/login?govbr=falha&returnTo=%2Finicio`);
  });

  it("só volta para caminhos internos", async () => {
    repo.buscarPorCpf.mockResolvedValue(usuario({ cpf: maria!.cpf }));
    const res = await entrarComo(0, undefined, "//site-externo.com");
    expect(res.headers.get("location")).toBe(`${FRONTEND}/#/inicio`);
  });
});
