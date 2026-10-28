import { Router, type Request } from "express";
import { HttpError } from "../../lib/http-error.js";
import { gerarHashSenha } from "../../lib/password.js";
import { pode } from "./auth.can.js";
import { usuarioRepository } from "./auth.repository.js";
import type { Usuario } from "./auth.types.js";
import { atualizarUsuarioSchema, criarUsuarioSchema, parseOrLancar } from "./usuarios-admin.schema.js";

export const usuariosAdminRouter = Router();

/**
 * Gestão de usuários — quem pode logar e quem é Administrador Estratégico
 * (papel_admin). Atribuir alguém como Gestor/Responsável de um eixo
 * específico continua sendo feito na estrutura do plano (managerIds/
 * reviewerIds do eixo, editado via PUT /api/v1/planning/workspace com
 * plan.manage) — este módulo só cria a conta em si.
 *
 * Gated por `model.manage`: é a única permissão administrativa "de
 * configuração do sistema" no contrato v1 (auth.contract.ts, PR #6) — não
 * existe um código de permissão dedicado a "user.manage".
 */
function exigirAdmin(req: Request): void {
  if (!pode(req.sumiSession, "model.manage")) {
    throw new HttpError(403, "Somente o Administrador Estratégico pode gerenciar usuários");
  }
}

function semSenha(usuario: Usuario) {
  const { senhaHash: _senhaHash, ...resto } = usuario;
  return resto;
}

usuariosAdminRouter.get("/api/v1/admin/usuarios", async (req, res, next) => {
  try {
    exigirAdmin(req);
    const usuarios = await usuarioRepository.listar();
    res.json(usuarios.map(semSenha));
  } catch (err) {
    next(err);
  }
});

usuariosAdminRouter.post("/api/v1/admin/usuarios", async (req, res, next) => {
  try {
    exigirAdmin(req);
    const input = parseOrLancar(criarUsuarioSchema, req.body);
    const existente = await usuarioRepository.buscarPorEmail(input.email);
    if (existente) throw new HttpError(409, "Já existe um usuário com este e-mail");
    const usuario = await usuarioRepository.criar({
      nome: input.nome,
      email: input.email,
      senhaHash: gerarHashSenha(input.senha),
      papelAdmin: input.papelAdmin,
    });
    res.status(201).json(semSenha(usuario));
  } catch (err) {
    next(err);
  }
});

usuariosAdminRouter.patch("/api/v1/admin/usuarios/:id", async (req, res, next) => {
  try {
    exigirAdmin(req);
    const input = parseOrLancar(atualizarUsuarioSchema, req.body);
    const usuario = await usuarioRepository.atualizar(req.params.id, {
      nome: input.nome,
      papelAdmin: input.papelAdmin,
      senhaHash: input.senha ? gerarHashSenha(input.senha) : undefined,
    });
    if (!usuario) throw new HttpError(404, "Usuário não encontrado");
    res.json(semSenha(usuario));
  } catch (err) {
    next(err);
  }
});

usuariosAdminRouter.delete("/api/v1/admin/usuarios/:id", async (req, res, next) => {
  try {
    exigirAdmin(req);
    if (req.sumiSession.user?.id === req.params.id) {
      throw new HttpError(409, "Você não pode remover a própria conta");
    }
    await usuarioRepository.remover(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
