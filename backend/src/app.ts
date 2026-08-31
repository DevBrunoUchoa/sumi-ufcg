import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

  // Em produção (imagem Docker), o build do frontend fica em <raiz>/dist/frontend
  // (ver Dockerfile e docs/architecture.md — unidade única de implantação).
  // Resolvido a partir da localização deste arquivo compilado
  // (<raiz>/backend/dist/app.js), não do cwd — funciona independente de como
  // o processo é iniciado (pnpm --filter backend start, node backend/dist/index.js, etc.).
  // Em desenvolvimento essa pasta não existe: o frontend roda no próprio
  // servidor do Vite, então o app segue só como API.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distFrontend = path.resolve(__dirname, "../../dist/frontend");
  if (fs.existsSync(distFrontend)) {
    app.use(express.static(distFrontend));
    // Qualquer GET não tratado pelas rotas acima (nem por express.static) é
    // uma rota do client-side router do frontend: devolve o index.html e
    // deixa o React decidir. Middleware simples em vez de app.get("*", ...)
    // porque o Express 5 (path-to-regexp v8) não aceita mais "*" solto como
    // padrão de rota.
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(path.join(distFrontend, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
