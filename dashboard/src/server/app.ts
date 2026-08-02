import express, { type Express } from "express";
import type { Server } from "node:http";
import { StateStore } from "./state.js";
import { buildRouter } from "./routes.js";

/** La app solo debe ser alcanzable desde la propia maquina en esta fase. */
export const LOOPBACK_HOST = "127.0.0.1";

export function buildApp(store: StateStore, actionsDir: string, publicDir: string): Express {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", buildRouter(store, actionsDir));
  app.use(express.static(publicDir));
  return app;
}

/**
 * Arranca el servidor escuchando UNICAMENTE en la interfaz de loopback
 * (127.0.0.1). No se expone en 0.0.0.0 ni en ninguna interfaz de red
 * externa — esta es la unica URL soportada en esta fase.
 */
export function listenLoopback(app: Express, port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, LOOPBACK_HOST, () => resolve(server));
  });
}
