#!/usr/bin/env node
// collect.mjs: diff -> files -> skill routes (+ repo-rule signals) as JSON on stdout.
// Usage: node collect.mjs [--base origin/main] [--cwd <repo>] [--no-fetch]
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  git, gitTry, repoRoot, mergeBase, workingTree, headTree, verdictKey, matchAny, pruneAll,
} from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|sql|ya?ml|sh)$/;

export function loadRouting(path = join(here, "..", "routing.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Pure routing: files -> { routes, uncovered }. `read(path)` returns content or null. */
export function route(files, routing, read = () => null) {
  const routes = {};
  for (const [skill, cfg] of Object.entries(routing.skills)) {
    const re = cfg.content ? new RegExp(cfg.content) : null;
    const hits = files.filter((f) => {
      if (cfg.exclude && matchAny(f, cfg.exclude)) return false;
      if (matchAny(f, cfg.globs ?? [])) return true;
      if (re && matchAny(f, cfg.contentGlobs ?? ["**/*.{ts,tsx,js,jsx,mjs}"])) {
        const text = read(f);
        return text != null && re.test(text);
      }
      return false;
    });
    if (hits.length) routes[skill] = hits;
  }
  const routed = new Set(Object.values(routes).flat());
  const uncovered = files.filter((f) => !routed.has(f) && SOURCE_EXT.test(f));
  return { routes, uncovered };
}

/** Skills on disk that are neither routed (known in routing.json) nor excluded. */
export function findSkillDrift(skillNames, routing) {
  const known = new Set([...Object.keys(routing.skills), ...(routing.excluded ?? [])]);
  return skillNames.filter((n) => !known.has(n)).sort();
}

function listSkillDirs(root) {
  const dir = join(root, ".claude", "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
}

export async function collect({ cwd = process.cwd(), base = "origin/main", fetch = true } = {}) {
  const root = repoRoot(cwd);
  const routing = loadRouting();
  const warnings = [];

  if (fetch && base.startsWith("origin/")) {
    const name = base.slice("origin/".length);
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
    if (gitTry(["fetch", "origin", name], { cwd: root, env }) === null) {
      warnings.push(`git fetch origin ${name} failed; using the local copy of ${base}`);
    }
  }
  const mb = mergeBase(base, root);
  const tree = workingTree(root);
  const key = verdictKey(mb, tree);

  const names = git(["diff", "--name-only", "--no-renames", mb, tree], { cwd: root, raw: true })
    .split("\n").filter(Boolean);
  const allFiles = names.sort();
  const files = allFiles.filter((f) => !matchAny(f, routing.ignore ?? []));
  const exists = (f) => gitTry(["cat-file", "-e", `${tree}:${f}`], { cwd: root }) !== null;
  const read = (f) => (exists(f) ? gitTry(["show", `${tree}:${f}`], { cwd: root, raw: true }) : null);
  const live = files.filter(exists); // routing looks at files still present
  const { routes, uncovered } = route(live, routing, read);
  const packages = (routing.packages ?? []).filter((p) => allFiles.some((f) => f.startsWith(p + "/")));
  const skillDrift = findSkillDrift(listSkillDirs(root), routing);

  const result = {
    base, mergeBase: mb, key, files, packages, routes,
    signals: [], ruleFindings: [], uncovered, skillDrift, warnings,
  };

  const rulesPath = join(here, "rules.mjs");
  if (existsSync(rulesPath)) {
    const mod = await import(pathToFileURL(rulesPath).href);
    if (typeof mod.runRules === "function") {
      const out = (await mod.runRules({
        cwd: root, base, mergeBase: mb, tree, headTree: headTree(root), key,
        files, allFiles, packages, routes, read,
      })) ?? {};
      result.signals = out.signals ?? [];
      result.ruleFindings = out.ruleFindings ?? [];
    }
  }
  return result;
}

function parseArgs(argv) {
  const o = { base: "origin/main", fetch: true, cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") o.base = argv[++i];
    else if (argv[i] === "--cwd") o.cwd = argv[++i];
    else if (argv[i] === "--no-fetch") o.fetch = false;
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv.slice(2));
  try {
    try { pruneAll(14, opts.cwd); } catch {}
    console.log(JSON.stringify(await collect(opts), null, 2));
  } catch (e) {
    console.error(`collect failed: ${e.message}`);
    process.exit(1);
  }
}
