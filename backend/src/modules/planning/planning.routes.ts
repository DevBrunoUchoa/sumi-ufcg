import { Router } from "express";
import { montarWorkspace, removerPlano, salvarWorkspace } from "./planning.service.js";
import { parseOrLancar, workspaceSchema } from "./planning.schema.js";

export const planningRouter = Router();

planningRouter.get("/api/v1/planning/workspace", async (req, res, next) => {
  try {
    res.json(await montarWorkspace(req.sumiSession));
  } catch (err) {
    next(err);
  }
});

planningRouter.put("/api/v1/planning/workspace", async (req, res, next) => {
  try {
    const workspace = parseOrLancar(workspaceSchema, req.body);
    await salvarWorkspace(req.sumiSession, workspace);
    res.json(await montarWorkspace(req.sumiSession));
  } catch (err) {
    next(err);
  }
});

planningRouter.delete("/api/v1/planning/planos/:id", async (req, res, next) => {
  try {
    await removerPlano(req.sumiSession, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
