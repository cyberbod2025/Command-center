import path from "node:path";
import { fileURLToPath } from "node:url";
import { StateStore } from "./state.js";
import { actionsDirFromDataDir } from "./routes.js";
import { buildApp, listenLoopback, LOOPBACK_HOST } from "./app.js";

// En dev (tsx) este archivo vive en src/server/, dos niveles bajo la raiz del dashboard.
// En build (tsc con rootDir=src/server) vive en dist/, un solo nivel bajo la raiz.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_ROOT = __dirname.endsWith(path.join("src", "server"))
  ? path.resolve(__dirname, "..", "..")
  : path.resolve(__dirname, "..");
const DATA_DIR = path.join(DASHBOARD_ROOT, "data");
const PUBLIC_DIR = path.join(DASHBOARD_ROOT, "src", "public");
const PORT = Number(process.env.PORT) || 4173;

const store = new StateStore(DATA_DIR);
const actionsDir = actionsDirFromDataDir(DATA_DIR);
const app = buildApp(store, actionsDir, PUBLIC_DIR);

listenLoopback(app, PORT).then(() => {
  console.log(`Command Center dashboard escuchando en http://${LOOPBACK_HOST}:${PORT} (solo loopback, sin exponer a la red)`);
  console.log(`Estado persistido en ${path.join(DATA_DIR, "command-center-state.json")}`);
});
