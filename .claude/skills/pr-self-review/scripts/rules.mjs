// rules.mjs: deterministic AGENTS.md rules. Called from collect.mjs as runRules(ctx).
// Returns { signals, ruleFindings }. No LLM, no network; only git via ctx.cwd.
import { posix } from "node:path";
import { git, gitTry, matchAny } from "./lib.mjs";

const ENV_FILES = [".env", ".env.local", "server/.env", "client/.env"];
const LOCK_FILES = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"];
const PKGS = ["server", "client", "reviewer-core", "e2e"];
const SPEC_PKGS = ["server", "client", "reviewer-core"];
const SPEC_TOUCH = ["adapters/", "platform/container.ts", "vendor/shared", "db/migrations"];
const CC_RE = /^(feat|fix|docs|chore|refactor|test|perf|build|ci|style|revert)(\(.+\))?!?: /;
const SECRET_RES = [
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY/,
];
const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

const finding = (f) => ({
  skill: "repo-rules", line: null, confidence: 1, fix: "", ...f, skillSeverity: f.severity,
});

/** Added lines per file: { file: [{ line, text }] } from a zero-context diff. */
export function addedLines(cwd, from, to) {
  const out = git(["-c", "core.quotepath=false", "diff", "-U0", "--no-renames", "--no-color", from, to],
    { cwd, raw: true });
  const res = {};
  let file = null, n = 0;
  for (const l of out.split("\n")) {
    if (l.startsWith("+++ ")) { file = l.startsWith("+++ b/") ? l.slice(6) : null; continue; }
    if (l.startsWith("--- ") || l.startsWith("diff ")) continue;
    const h = /^@@ -\S+ \+(\d+)/.exec(l);
    if (h) { n = Number(h[1]); continue; }
    if (file && l.startsWith("+")) (res[file] ??= []).push({ line: n++, text: l.slice(1) });
  }
  return res;
}

function numstat(cwd, from, to) {
  const out = git(["-c", "core.quotepath=false", "diff", "--numstat", "--no-renames", from, to],
    { cwd, raw: true });
  const res = {};
  for (const l of out.split("\n").filter(Boolean)) {
    const [a, d, ...p] = l.split("\t");
    res[p.join("\t")] = (Number(a) || 0) + (Number(d) || 0);
  }
  return res;
}

function workflowPaths(cwd, tree) {
  const names = (gitTry(["ls-tree", "--name-only", tree, ".github/workflows/"], { cwd }) ?? "")
    .split("\n").filter((n) => /\.ya?ml$/.test(n));
  return names.map((n) => {
    const text = gitTry(["show", `${tree}:${n}`], { cwd, raw: true }) ?? "";
    const paths = [];
    let inPaths = false;
    for (const l of text.split("\n")) {
      if (/^\s*paths:\s*$/.test(l)) { inPaths = true; continue; }
      const item = /^\s*-\s*['"]?([^'"\s#]+)['"]?\s*(#.*)?$/.exec(l);
      if (inPaths && item) paths.push(item[1]);
      else if (!/^\s*(#.*)?$/.test(l)) inPaths = false;
    }
    return { name: n, paths };
  });
}

function vendoredSkillDirs(ctx) {
  // Union of the lock in the working tree and at the merge-base, so removing an entry is still caught.
  const texts = [ctx.read("skills-lock.json"),
    gitTry(["show", `${ctx.mergeBase}:skills-lock.json`], { cwd: ctx.cwd, raw: true })];
  const names = new Set();
  for (const t of texts) {
    try { Object.keys(JSON.parse(t).skills ?? {}).forEach((n) => names.add(n)); } catch {}
  }
  return [...names];
}

export async function runRules(ctx) {
  const { cwd, mergeBase, tree, allFiles } = ctx;
  const findings = [];
  const signals = [];
  const added = addedLines(cwd, mergeBase, tree);
  const has = (f) => allFiles.includes(f);

  // 1. do-not-touch .env files
  for (const f of allFiles.filter((f) => ENV_FILES.includes(f))) {
    findings.push(finding({
      file: f, rule: "do-not-touch-env", severity: "critical", needsVerification: false,
      evidence: `${f} is part of the diff (git-ignored secrets file)`,
      fix: "Remove it from the change; edit .env.example instead.",
    }));
  }

  // 2. secrets in added lines (candidates for the verifier)
  for (const [file, lines] of Object.entries(added)) {
    for (const { line, text } of lines) {
      const re = SECRET_RES.find((r) => r.test(text));
      if (!re) continue;
      const m = re.exec(text)[0];
      findings.push(finding({
        file, line, rule: "secret-in-diff", severity: "critical", confidence: 0.6,
        needsVerification: true,
        evidence: `possible secret "${m.slice(0, 6)}..." in an added line`,
        fix: "Remove the secret, rotate it, and load it from the environment.",
      }));
    }
  }

  // 3. vendored skills / skills-lock.json
  const vendored = vendoredSkillDirs(ctx);
  for (const f of allFiles) {
    const name = /^\.claude\/skills\/([^/]+)\//.exec(f)?.[1];
    if (f === "skills-lock.json" || (name && vendored.includes(name))) {
      findings.push(finding({
        file: f, rule: "vendored-skill-modified", severity: "high",
        evidence: f === "skills-lock.json" ? "skills-lock.json changed" : `vendored skill "${name}" changed`,
        fix: "Vendored skills are not edited to fit a feature; revert or adjust the skill upstream.",
      }));
    }
  }

  // 4. lock file changed without package.json of the same package
  for (const f of allFiles.filter((f) => LOCK_FILES.includes(posix.basename(f)))) {
    const dir = posix.dirname(f);
    const pkgJson = dir === "." ? "package.json" : `${dir}/package.json`;
    if (!has(pkgJson)) {
      findings.push(finding({
        file: f, rule: "lock-without-package-json", severity: "high",
        evidence: `${f} changed but ${pkgJson} did not`,
        fix: "Revert the lock file change or include the matching dependency change.",
      }));
    }
  }

  // 5. vendor/shared changed in one copy only
  const shared = {};
  for (const f of allFiles) {
    const m = /^([^/]+)\/src\/vendor\/shared\//.exec(f);
    if (m) (shared[m[1]] ??= []).push(f);
  }
  if (Object.keys(shared).length === 1) {
    const [pkg, files] = Object.entries(shared)[0];
    const others = ["server", "client"].filter((p) => p !== pkg);
    signals.push({
      type: "vendor-shared-single-copy", for: ["zod", "onion-architecture"], files,
      message: `vendor/shared changed only in ${pkg}; the copies already differ, check ${others.join("/")} for contract drift`,
    });
  }

  // 6. new cross-package dependency without matching workflow paths
  const flows = workflowPaths(cwd, tree);
  const seen = new Set();
  for (const [file, lines] of Object.entries(added)) {
    const pkg = file.split("/")[0];
    if (!PKGS.includes(pkg) || !CODE_FILE.test(file)) continue;
    for (const { line, text } of lines) {
      let target = null;
      if (/@devdigest\/reviewer-core/.test(text)) target = "reviewer-core";
      else target = /(?:\.\.\/)+(server|client|reviewer-core|e2e)\//.exec(text)?.[1] ?? null;
      if (!target || target === pkg || seen.has(`${pkg}>${target}`)) continue;
      const own = flows.filter((w) => w.paths.some((p) => p.startsWith(`${pkg}/`)));
      if (own.some((w) => w.paths.some((p) => p.startsWith(`${target}/`)))) continue;
      seen.add(`${pkg}>${target}`);
      findings.push(finding({
        file, line, rule: "cross-package-without-ci-paths", severity: "high",
        evidence: own.length
          ? `${pkg} now imports ${target} but ${own.map((w) => w.name).join(", ")} paths: has no ${target}/**`
          : `${pkg} now imports ${target} but no .github/workflows/*.yml has a paths: filter for ${pkg}/**`,
        fix: own.length
          ? `Add '${target}/**' to the paths: filters of ${own.map((w) => w.name).join(", ")}.`
          : `Add or update a workflow with a paths: filter covering '${pkg}/**' and '${target}/**'.`,
      }));
    }
  }

  // 7. spec-first for medium+ changes
  const stat = numstat(cwd, mergeBase, tree);
  const hasSpec = allFiles.some((f) => matchAny(f, ["*/specs/**/*.md"]));
  if (!hasSpec) {
    for (const pkg of SPEC_PKGS) {
      const src = allFiles.filter((f) => f.startsWith(`${pkg}/src/`));
      if (!src.length) continue;
      const lines = src.reduce((s, f) => s + (stat[f] ?? 0), 0);
      const touched = src.find((f) => SPEC_TOUCH.some((t) => f.slice(`${pkg}/src/`.length).includes(t)));
      if (lines > 150 || src.length > 5 || touched) {
        findings.push(finding({
          file: touched ?? src[0], rule: "spec-first", severity: "high",
          evidence: `${pkg}/src: ${lines} changed lines in ${src.length} files${touched ? `, touches ${touched}` : ""}; no */specs/*.md added or changed`,
          fix: `Add or update a spec in ${pkg}/specs/ (or the owning package) before merging.`,
        }));
      }
    }
  }

  // 8. Conventional Commits
  const subjects = (gitTry(["log", `${mergeBase}..HEAD`, "--format=%s"], { cwd }) ?? "")
    .split("\n").filter(Boolean);
  for (const s of subjects) {
    if (CC_RE.test(s) || /^Merge /.test(s)) continue;
    findings.push(finding({
      file: null, rule: "conventional-commits", severity: "medium",
      evidence: `commit subject "${s}" is not a Conventional Commit`,
      fix: "Reword it as type(scope): subject, e.g. feat(reviews): ...",
    }));
  }

  return { signals, ruleFindings: findings };
}
