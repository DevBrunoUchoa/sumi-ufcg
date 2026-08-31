import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { healthRouter } from "./routes/health.route.js";
import { planosRouter } from "./modules/planos/planos.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);

  // Rotas de domínio entram aqui conforme forem implementadas em src/modules/*.
  app.use(planosRouter);
  // app.use(indicadoresRouter); app.use(riscosRouter); app.use(authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
