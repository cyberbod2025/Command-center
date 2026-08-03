import { newId, nowIso } from "./ids.js";
import type { AuditEntry, CommandCenterState } from "./types.js";

export function recordAudit(
  state: CommandCenterState,
  entry: Omit<AuditEntry, "id" | "ts">
): AuditEntry {
  const record: AuditEntry = { id: newId("audit"), ts: nowIso(), ...entry };
  state.audit.push(record);
  return record;
}
