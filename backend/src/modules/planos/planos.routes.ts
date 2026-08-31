import { Router } from "express";
import { HttpError } from "../../middlewares/error-handler.js";
import { planosService } from "./planos.service.js";
import {
  noPlanoCreateSchema,
  noPlanoUpdateSchema,
  parseOrLancar,
  reordenarNoPlanoSchema,
  tipoPlanoCreateSchema,
  tipoPlanoUpdateSchema,
} from "./planos.schema.js";

export const planosRouter = Router();

function assertUuid(valor: string, campo: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(valor)) throw new HttpError(400, `${campo} inválido`);
}

// ---- tipo_plano ----------------------------------------------------------

planosRouter.get("/tipos-plano", async (req, res, next) => {
  try {
    const apenasAtivos = req.query.ativos === "true";
    res.json(await planosService.listarTiposPlano({ apenasAtivos }));
  } catch (err) {
    next(err);
  }
});

planosRouter.get("/tipos-plano/:id", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    res.json(await planosService.buscarTipoPlano(req.params.id));
  } catch (err) {
    next(err);
  }
});

planosRouter.post("/tipos-plano", async (req, res, next) => {
  try {
    const input = parseOrLancar(tipoPlanoCreateSchema, req.body);
    const criado = await planosService.criarTipoPlano(input);
    res.status(201).json(criado);
  } catch (err) {
    next(err);
  }
});

planosRouter.patch("/tipos-plano/:id", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    const input = parseOrLancar(tipoPlanoUpdateSchema, req.body);
    res.json(await planosService.atualizarTipoPlano(req.params.id, input));
  } catch (err) {
    next(err);
  }
});

// ---- no_plano -------------------------------------------------------------

planosRouter.get("/nos-plano", async (req, res, next) => {
  try {
    const noPaiId = req.query.noPaiId;
    if (noPaiId !== undefined && noPaiId !== "null") assertUuid(String(noPaiId), "noPaiId");
    const filtro = noPaiId === undefined || noPaiId === "null" ? null : String(noPaiId);
    res.json(await planosService.listarFilhos(filtro));
  } catch (err) {
    next(err);
  }
});

planosRouter.get("/nos-plano/:id", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    res.json(await planosService.buscarNoPlano(req.params.id));
  } catch (err) {
    next(err);
  }
});

planosRouter.get("/nos-plano/:id/arvore", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    res.json(await planosService.obterArvore(req.params.id));
  } catch (err) {
    next(err);
  }
});

planosRouter.post("/nos-plano", async (req, res, next) => {
  try {
    const input = parseOrLancar(noPlanoCreateSchema, req.body);
    const criado = await planosService.criarNoPlano(input);
    res.status(201).json(criado);
  } catch (err) {
    next(err);
  }
});

planosRouter.patch("/nos-plano/:id", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    const input = parseOrLancar(noPlanoUpdateSchema, req.body);
    res.json(await planosService.atualizarDadosNoPlano(req.params.id, input.dados));
  } catch (err) {
    next(err);
  }
});

planosRouter.post("/nos-plano/:id/mover", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    const input = parseOrLancar(reordenarNoPlanoSchema, req.body);
    res.json(await planosService.moverNoPlano(req.params.id, { novoPaiId: input.novoPaiId, novaOrdem: input.novaOrdem }));
  } catch (err) {
    next(err);
  }
});

planosRouter.delete("/nos-plano/:id", async (req, res, next) => {
  try {
    assertUuid(req.params.id, "id");
    await planosService.removerNoPlano(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
