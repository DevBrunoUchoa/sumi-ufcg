import { Router } from "express";
import multer from "multer";
import { HttpError } from "../../lib/http-error.js";
import { pode } from "../auth/auth.can.js";
import { exportarPlanoXlsx, gerarModeloXlsx, importarPlanilha } from "./importacao.service.js";
import { montarWorkspace } from "./planning.service.js";

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

importacaoRouter.get("/api/v1/planning/planos/:planId/exportacao", async (req, res, next) => {
  try {
    const planId = String(req.params.planId);
    if (!pode(req.sumiSession, "plan.read_internal", { planId })) throw new HttpError(403, "Sem permissão para exportar este plano");
    const workspace = await montarWorkspace(req.sumiSession);
    const plano = workspace.plans.find((p) => p.id === planId);
    if (!plano) throw new HttpError(404, `Plano "${planId}" não encontrado.`);
    const buffer = await exportarPlanoXlsx(plano);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${plano.shortName.replace(/[^\w.-]+/g, "_")}-sumi.xlsx"`);
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
    const resumo = await importarPlanilha(req.sumiSession, String(req.params.planId), req.file);
    res.status(200).json(resumo);
  } catch (err) {
    next(err);
  }
});
