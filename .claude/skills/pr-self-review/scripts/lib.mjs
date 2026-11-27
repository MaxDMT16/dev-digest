// Shared helpers for pr-self-review scripts. Plain Node >= 22, zero dependencies.
import { execFileSync } from "node:child_process";
import { matchesGlob, join, resolve } from "node:path";
import { mkdtempSync, rmSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";

/** Run git and return trimmed stdout. Throws on non-zero exit. */
export function git(args, { cwd = process.cwd(), env = {}, raw = false } = {}) {
  const out = execFileSync("git", args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return raw ? out : out.trim();
}

/** Like git() but returns null instead of throwing. */
export function gitTry(args, opts) {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
}

export function repoRoot(cwd = process.cwd()) {
  return git(["rev-parse", "--show-toplevel"], { cwd });
}

export function mergeBase(base, cwd = process.cwd(), head = "HEAD") {
  return git(["merge-base", base, head], { cwd });
}

export function headTree(cwd = process.cwd()) {
  return git(["rev-parse", "HEAD^{tree}"], { cwd });
}

/**
 * Tree sha of the working copy (tracked + staged + unstaged + untracked, minus
 * ignored) computed through a temporary index; the user's real index is untouched.
 */
export function workingTree(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  const dir = mkdtempSync(join(tmpdir(), "pr-self-review-idx-"));
  const env = { GIT_INDEX_FILE: join(dir, "index") };
  try {
    git(["read-tree", "HEAD"], { cwd: root, env });
    git(["add", "-A"], { cwd: root, env });
    return git(["write-tree"], { cwd: root, env });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Verdict key: `<merge-base sha>:<tree sha>`. tree defaults to the working copy. */
export function verdictKey(mergeBaseSha, tree) {
  return `${mergeBaseSha}:${tree}`;
}

/** Tree sha of a subdirectory inside a tree, or null if it does not exist. */
export function subtreeSha(tree, path, cwd = process.cwd()) {
  return gitTry(["rev-parse", `${tree}:${path}`], { cwd });
}

/** Blob sha of a file at a rev/tree, or null if absent. */
export function blobSha(rev, path, cwd = process.cwd()) {
  return gitTry(["rev-parse", `${rev}:${path}`], { cwd });
}

/**
 * Package key for checks: subtree sha of the package plus those of its
 * dependencies (deps: { server: ["reviewer-core"] }), joined with "+".
 */
export function packageKey(tree, pkg, deps = {}, cwd = process.cwd()) {
  const names = [pkg, ...(deps[pkg] ?? [])];
  return names.map((n) => `${n}=${subtreeSha(tree, n, cwd) ?? "none"}`).join("+");
}

/** `$(git rev-parse --git-common-dir)/pr-self-review[/sub]`, created on demand. */
export function storageDir(sub, cwd = process.cwd()) {
  const common = resolve(cwd, git(["rev-parse", "--git-common-dir"], { cwd }));
  const dir = sub ? join(common, "pr-self-review", sub) : join(common, "pr-self-review");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Delete files/dirs older than `days` (by mtime) directly under dir. Returns count. */
export function prune(dir, days = 14, now = Date.now()) {
  if (!existsSync(dir)) return 0;
  const cutoff = now - days * 86400_000;
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      if (statSync(p).mtimeMs < cutoff) {
        rmSync(p, { recursive: true, force: true });
        n++;
      }
    } catch {}
  }
  return n;
}

/** Prune every storage subdirectory. */
export function pruneAll(days = 14, cwd = process.cwd()) {
  let n = 0;
  for (const sub of ["verdicts", "checks", "findings", "verify", "reports"]) {
    n += prune(storageDir(sub, cwd), days);
  }
  return n;
}

/**
 * True when path matches at least one glob (path.matchesGlob semantics).
 * path.matchesGlob's `**` and `*` skip dot-segments (".claude/x.md" vs "**\/*.md"),
 * so each glob is tried against the raw path and a dot-neutralised copy.
 */
export function matchAny(path, globs = []) {
  const neutral = path.replace(/(^|\/)\./g, "$1_dot_");
  return globs.some((g) => matchesGlob(path, g) || matchesGlob(neutral, g));
}
