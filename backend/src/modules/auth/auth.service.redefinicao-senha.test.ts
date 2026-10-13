import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buscarPorEmail: vi.fn(),
  atualizar: vi.fn(),
  criarToken: vi.fn(),
  buscarValido: vi.fn(),
  marcarUsado: vi.fn(),
  enviar: vi.fn(),
}));

vi.mock("./auth.repository.js", () => ({
  usuarioRepository: { buscarPorEmail: mocks.buscarPorEmail, atualizar: mocks.atualizar },
  sessaoRepository: {},
  eixoRepository: {},
  redefinicaoSenhaRepository: { criar: mocks.criarToken, buscarValido: mocks.buscarValido, marcarUsado: mocks.marcarUsado },
}));

vi.mock("../../lib/mailer.js", () => ({
  mailer: { enviar: mocks.enviar },
}));

import { authService } from "./auth.service.js";

describe("solicitarRedefinicaoSenha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não cria token nem envia e-mail quando o e-mail não existe (não revela se existe)", async () => {
    mocks.buscarPorEmail.mockResolvedValue(null);
    await expect(authService.solicitarRedefinicaoSenha("ninguem@ufcg.edu.br")).resolves.toBeUndefined();
    expect(mocks.criarToken).not.toHaveBeenCalled();
    expect(mocks.enviar).not.toHaveBeenCalled();
  });

  it("cria token e envia e-mail com o link de redefinição quando o e-mail existe", async () => {
    mocks.buscarPorEmail.mockResolvedValue({ id: "u1", nome: "Maria", email: "maria@ufcg.edu.br", senhaHash: "x", papelAdmin: false, criadoEm: "", atualizadoEm: "" });
    mocks.criarToken.mockResolvedValue("11111111-1111-1111-1111-111111111111");
    mocks.enviar.mockResolvedValue(undefined);

    await authService.solicitarRedefinicaoSenha("maria@ufcg.edu.br");

    expect(mocks.criarToken).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "u1" }));
    expect(mocks.enviar).toHaveBeenCalledTimes(1);
    const email = mocks.enviar.mock.calls[0]![0];
    expect(email.to).toBe("maria@ufcg.edu.br");
    expect(email.html).toContain("11111111-1111-1111-1111-111111111111");
  });

  it("não lança mesmo se o envio de e-mail falhar (melhor esforço)", async () => {
    mocks.buscarPorEmail.mockResolvedValue({ id: "u1", nome: "Maria", email: "maria@ufcg.edu.br", senhaHash: "x", papelAdmin: false, criadoEm: "", atualizadoEm: "" });
    mocks.criarToken.mockResolvedValue("token-1");
    mocks.enviar.mockRejectedValue(new Error("SMTP indisponível"));

    await expect(authService.solicitarRedefinicaoSenha("maria@ufcg.edu.br")).resolves.toBeUndefined();
  });
});

describe("redefinirSenha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita token inválido/expirado sem tocar no usuário", async () => {
    mocks.buscarValido.mockResolvedValue(null);
    await expect(authService.redefinirSenha("token-invalido", "novaSenha123")).rejects.toMatchObject({ status: 400 });
    expect(mocks.atualizar).not.toHaveBeenCalled();
    expect(mocks.marcarUsado).not.toHaveBeenCalled();
  });

  it("atualiza a senha e marca o token como usado quando válido", async () => {
    mocks.buscarValido.mockResolvedValue({ usuarioId: "u1" });
    mocks.atualizar.mockResolvedValue(undefined);
    mocks.marcarUsado.mockResolvedValue(undefined);

    await authService.redefinirSenha("token-valido", "novaSenha123");

    expect(mocks.atualizar).toHaveBeenCalledWith("u1", expect.objectContaining({ senhaHash: expect.any(String) }));
    expect(mocks.marcarUsado).toHaveBeenCalledWith("token-valido");
  });
});
