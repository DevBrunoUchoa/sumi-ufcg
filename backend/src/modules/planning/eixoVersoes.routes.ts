import { Router } from "express";
import { eixoVersoesService } from "./eixoVersoes.service.js";

export const eixoVersoesRouter = Router();

eixoVersoesRouter.get("/api/v1/planning/eixos/:eixoId/versoes", async (req, res, next) => {
  try {
    res.json(await eixoVersoesService.listar(req.sumiSession, req.params.eixoId));
  } catch (err) {
    next(err);
  }
});

eixoVersoesRouter.get("/api/v1/planning/eixo-versoes/:versaoId/url", async (req, res, next) => {
  try {
    res.json(await eixoVersoesService.gerarUrlDownload(req.sumiSession, req.params.versaoId));
  } catch (err) {
    next(err);
  }
});
