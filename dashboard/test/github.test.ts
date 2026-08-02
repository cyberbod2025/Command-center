import { describe, it, expect } from "vitest";
import { isAllowedRepo, ALLOWED_REPOS, RepoNotAllowedError } from "../src/server/github.js";

describe("lista cerrada de repositorios", () => {
  it("acepta solo los tres repositorios declarados", () => {
    for (const repo of ALLOWED_REPOS) {
      expect(isAllowedRepo(repo)).toBe(true);
    }
  });

  it("rechaza cualquier otro repositorio", () => {
    expect(isAllowedRepo("cyberbod2025/otro-repo")).toBe(false);
    expect(isAllowedRepo("")).toBe(false);
    expect(isAllowedRepo("owner/Command-center")).toBe(false);
  });

  it("el error de repo no permitido incluye la lista cerrada", () => {
    const err = new RepoNotAllowedError("owner/otro");
    expect(err.message).toContain("cyberbod2025/Command-center");
    expect(err.message).toContain("owner/otro");
  });
});
