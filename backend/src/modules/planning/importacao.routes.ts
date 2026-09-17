import { Router } from "express";
import multer from "multer";
import { gerarModeloXlsx, importarPlanilha } from "./importacao.service.js";

const TAMANHO_MAXIMO_PLANILHA_BYTES = 15 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO_PLANILHA_BYTES } });

export const importacaoRouter = Router();

importacaoRouter.get("/api/v1/planning/importacao/modelo", async (_req, res, next) => {
  try {
    const buffer = await gerarModeloXlsx();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modelo-monitoramento-pdi-sumi.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

importacaoRouter.post("/api/v1/planning/planos/:planId/importacao", upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado (campo 'arquivo')" });
      return;
    }
    const resumo = await importarPlanilha(req.sumiSession, String(req.params.planId), req.file.buffer);
    res.status(200).json(resumo);
  } catch (err) {
    next(err);
  }
});
