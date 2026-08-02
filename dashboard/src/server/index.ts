import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StateStore } from "./state.js";
import { buildRouter, actionsDirFromDataDir } from "./routes.js";

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

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use("/api", buildRouter(store, actionsDir));
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`Command Center dashboard escuchando en http://localhost:${PORT}`);
  console.log(`Estado persistido en ${path.join(DATA_DIR, "command-center-state.json")}`);
});
