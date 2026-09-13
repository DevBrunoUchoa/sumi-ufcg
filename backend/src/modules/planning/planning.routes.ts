import { Router } from "express";
import { montarWorkspace, salvarWorkspace } from "./planning.service.js";
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
