import { promises as fs } from "node:fs";
import path from "node:path";
import { SCHEMA_VERSION, type CommandCenterState } from "./types.js";
import { buildSeedState } from "./seed.js";
import { nowIso } from "./ids.js";

const MAX_BACKUPS = 20;

export class StateStore {
  private readonly filePath: string;
  private readonly backupDir: string;
  private writeLock: Promise<unknown> = Promise.resolve();
  private cache: CommandCenterState | null = null;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "command-center-state.json");
    this.backupDir = path.join(dataDir, "backups");
  }

  async load(): Promise<CommandCenterState> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as CommandCenterState;
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(
          `Esquema incompatible: archivo tiene version ${parsed.schemaVersion}, la app espera ${SCHEMA_VERSION}. Migra manualmente antes de continuar.`
        );
      }
      this.cache = parsed;
      return parsed;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        const seeded = buildSeedState();
        await this.writeAtomic(seeded);
        this.cache = seeded;
        return seeded;
      }
      throw err;
    }
  }

  /**
   * Aplica una mutacion sobre el estado actual y persiste el resultado.
   * Las mutaciones se serializan para evitar condiciones de carrera entre
   * peticiones concurrentes sobre el mismo archivo.
   */
  async mutate<T>(fn: (state: CommandCenterState) => T): Promise<T> {
    const run = this.writeLock.then(async () => {
      const state = await this.load();
      const result = fn(state);
      state.updatedAt = nowIso();
      await this.writeAtomic(state);
      this.cache = state;
      return result;
    });
    this.writeLock = run.catch(() => undefined);
    return run;
  }

  private async writeAtomic(state: CommandCenterState): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });

    await this.backupCurrent();

    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    const json = JSON.stringify(state, null, 2);
    const handle = await fs.open(tmpPath, "w");
    try {
      await handle.writeFile(json, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, this.filePath);
  }

  private async backupCurrent(): Promise<void> {
    try {
      const stat = await fs.stat(this.filePath);
      if (!stat.isFile()) return;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(this.backupDir, `command-center-state.${stamp}.json`);
      await fs.copyFile(this.filePath, backupPath);
      await this.pruneBackups();
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") throw err;
    }
  }

  private async pruneBackups(): Promise<void> {
    const files = (await fs.readdir(this.backupDir))
      .filter((f) => f.startsWith("command-center-state.") && f.endsWith(".json"))
      .sort();
    const excess = files.length - MAX_BACKUPS;
    if (excess <= 0) return;
    for (const f of files.slice(0, excess)) {
      await fs.rm(path.join(this.backupDir, f), { force: true });
    }
  }
}
