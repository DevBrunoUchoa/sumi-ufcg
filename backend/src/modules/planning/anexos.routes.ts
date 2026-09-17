import { Router } from "express";
import multer from "multer";
import { anexosService, TAMANHO_MAXIMO_BYTES } from "./anexos.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_BYTES } });

export const anexosRouter = Router();

anexosRouter.get("/api/v1/planning/itens/:itemId/anexos", async (req, res, next) => {
  try {
    res.json(await anexosService.listar(req.sumiSession, req.params.itemId));
  } catch (err) {
    next(err);
  }
});

anexosRouter.post("/api/v1/planning/itens/:itemId/anexos", upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado (campo 'arquivo')" });
      return;
    }
    const etapaId = typeof req.body.etapaId === "string" && req.body.etapaId ? req.body.etapaId : null;
    const resultadoId = typeof req.body.resultadoId === "string" && req.body.resultadoId ? req.body.resultadoId : null;
    const anexo = await anexosService.enviar(req.sumiSession, String(req.params.itemId), req.file, { etapaId, resultadoId });
    res.status(201).json(anexo);
  } catch (err) {
    next(err);
  }
});

anexosRouter.get("/api/v1/planning/anexos/:anexoId/url", async (req, res, next) => {
  try {
    res.json(await anexosService.gerarUrlDownload(req.sumiSession, req.params.anexoId));
  } catch (err) {
    next(err);
  }
});

anexosRouter.delete("/api/v1/planning/anexos/:anexoId", async (req, res, next) => {
  try {
    await anexosService.remover(req.sumiSession, req.params.anexoId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
