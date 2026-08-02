import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const execFile = promisify(execFileCb);

/**
 * Lista cerrada de repositorios que esta app puede consultar.
 * Cualquier otro repo se rechaza antes de tocar `gh`.
 */
export const ALLOWED_REPOS = [
  "cyberbod2025/Command-center",
  "cyberbod2025/NUEVO-HORIZONTE",
  "cyberbod2025/SASE-ZERO",
] as const;
export type AllowedRepo = (typeof ALLOWED_REPOS)[number];

export function isAllowedRepo(repo: string): repo is AllowedRepo {
  return (ALLOWED_REPOS as readonly string[]).includes(repo);
}

export class RepoNotAllowedError extends Error {
  constructor(repo: string) {
    super(`Repositorio no permitido: ${repo}. Lista cerrada: ${ALLOWED_REPOS.join(", ")}`);
    this.name = "RepoNotAllowedError";
  }
}

export interface GithubAuthStatus {
  available: boolean;
  login?: string;
  detail: string;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  baseRefName: string;
  headRefName: string;
  headRefOidShort: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewThread {
  id: string;
  isResolved: boolean;
  path: string | null;
  author: string | null;
  bodyPreview: string;
  url: string | null;
}

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
}

export interface PullRequestDetail extends PullRequestSummary {
  mergeable: string | null;
  reviewDecision: string | null;
  commitsCount: number;
  reviewThreads: ReviewThread[];
  checks: CheckRun[];
}

async function runGh(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFile("gh", args, {
      timeout: 20_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(`gh ${args[0]} fallo: ${(e.stderr || e.message || "error desconocido").trim()}`);
  }
}

export async function getAuthStatus(): Promise<GithubAuthStatus> {
  try {
    const out = await execFile("gh", ["auth", "status"], { timeout: 10_000, windowsHide: true });
    const text = `${out.stdout}\n${out.stderr}`;
    const loginMatch = text.match(/Logged in to github\.com account (\S+)/);
    return {
      available: true,
      login: loginMatch?.[1],
      detail: "Sesion de gh CLI activa.",
    };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return {
      available: false,
      detail: `conexion no disponible: ${(e.stderr || e.message || "gh no respondio").trim()}`,
    };
  }
}

function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "";
}

export async function listPullRequests(repo: string): Promise<PullRequestSummary[]> {
  if (!isAllowedRepo(repo)) throw new RepoNotAllowedError(repo);
  const out = await runGh([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "30",
    "--json",
    "number,title,state,isDraft,baseRefName,headRefName,headRefOid,url,createdAt,updatedAt",
  ]);
  const raw = JSON.parse(out) as Array<{
    number: number;
    title: string;
    state: string;
    isDraft: boolean;
    baseRefName: string;
    headRefName: string;
    headRefOid: string;
    url: string;
    createdAt: string;
    updatedAt: string;
  }>;
  return raw.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state as PullRequestSummary["state"],
    isDraft: pr.isDraft,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    headRefOidShort: shortSha(pr.headRefOid),
    url: pr.url,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
  }));
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { path body url author { login } }
          }
        }
      }
    }
  }
}`;

export async function getPullRequest(repo: string, number: number): Promise<PullRequestDetail> {
  if (!isAllowedRepo(repo)) throw new RepoNotAllowedError(repo);
  const [owner, name] = repo.split("/");

  const viewOut = await runGh([
    "pr",
    "view",
    String(number),
    "--repo",
    repo,
    "--json",
    "number,title,state,isDraft,baseRefName,headRefName,headRefOid,url,createdAt,updatedAt,mergeable,reviewDecision,commits,statusCheckRollup",
  ]);
  const view = JSON.parse(viewOut) as {
    number: number;
    title: string;
    state: string;
    isDraft: boolean;
    baseRefName: string;
    headRefName: string;
    headRefOid: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    mergeable: string | null;
    reviewDecision: string | null;
    commits: unknown[];
    statusCheckRollup: Array<{ name?: string; workflowName?: string; status?: string; conclusion?: string | null }> | null;
  };

  let threads: ReviewThread[] = [];
  try {
    const graphqlOut = await runGh([
      "api",
      "graphql",
      "-f",
      `query=${REVIEW_THREADS_QUERY}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `number=${number}`,
    ]);
    const parsed = JSON.parse(graphqlOut) as {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: Array<{
                id: string;
                isResolved: boolean;
                comments: { nodes: Array<{ path: string; body: string; url: string; author: { login: string } | null }> };
              }>;
            };
          };
        };
      };
    };
    threads = parsed.data.repository.pullRequest.reviewThreads.nodes.map((n) => {
      const first = n.comments.nodes[0];
      return {
        id: n.id,
        isResolved: n.isResolved,
        path: first?.path ?? null,
        author: first?.author?.login ?? null,
        bodyPreview: first ? first.body.slice(0, 240) : "",
        url: first?.url ?? null,
      };
    });
  } catch {
    threads = [];
  }

  const checks: CheckRun[] = (view.statusCheckRollup ?? []).map((c) => ({
    name: c.name || c.workflowName || "check",
    status: c.status || "UNKNOWN",
    conclusion: c.conclusion ?? null,
  }));

  return {
    number: view.number,
    title: view.title,
    state: view.state as PullRequestDetail["state"],
    isDraft: view.isDraft,
    baseRefName: view.baseRefName,
    headRefName: view.headRefName,
    headRefOidShort: shortSha(view.headRefOid),
    url: view.url,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    mergeable: view.mergeable,
    reviewDecision: view.reviewDecision,
    commitsCount: Array.isArray(view.commits) ? view.commits.length : 0,
    reviewThreads: threads,
    checks,
  };
}

/**
 * Unica escritura remota permitida: publicar un comentario de texto en un PR.
 * El cuerpo se escribe a un archivo temporal y se pasa con --body-file para
 * evitar cualquier interpretacion de shell (execFile nunca usa shell).
 */
export async function postPullRequestComment(
  repo: string,
  number: number,
  body: string
): Promise<{ url: string }> {
  if (!isAllowedRepo(repo)) throw new RepoNotAllowedError(repo);
  if (!body.trim()) throw new Error("El comentario no puede estar vacio.");

  const tmpFile = path.join(os.tmpdir(), `cc-comment-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  await fs.writeFile(tmpFile, body, "utf8");
  try {
    const out = await runGh(["pr", "comment", String(number), "--repo", repo, "--body-file", tmpFile]);
    const url = out.trim().split("\n").filter(Boolean).pop() || "";
    return { url };
  } finally {
    await fs.rm(tmpFile, { force: true });
  }
}
