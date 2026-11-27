// Typecheck/test the touched packages (plus dependents), in parallel, cached per package key.
// CLI: node checks.mjs [--base origin/main] [--cwd dir] [--packages a,b] [--fresh]
// Prints JSON {status: pass|fail|error, results, recommendations}; stdout is JSON only.
import { spawn } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { repoRoot, workingTree, packageKey, storageDir, matchAny } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const TAIL = 4000;

export function loadChecksConfig(path = join(here, "..", "checks.json")) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Default runner: runs a shell command in cwd with a timeout. Resolves {code, output}. */
export function shellRunner(cmd, { cwd, timeout }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const add = (b) => { out = (out + b).slice(-64 * 1024); };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const timer = setTimeout(() => { out += `\n[timed out after ${timeout}ms]`; child.kill("SIGKILL"); }, timeout);
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: 127, output: String(e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, output: out }); });
  });
}

/** Touched packages plus those that must also be checked because of them (alsoChecks). */
export function expandPackages(touched, config) {
  const set = new Set(touched.filter((p) => config.packages[p]));
  for (const p of [...set]) for (const d of config.packages[p].alsoChecks ?? []) set.add(d);
  return [...set];
}

const tail = (s) => (s.length > TAIL ? "..." + s.slice(-TAIL) : s);

async function checkPackage(pkg, { cwd, config, runner, tree, fresh, timeout }) {
  const spec = config.packages[pkg];
  const key = packageKey(tree, pkg, config.keyDeps ?? {}, cwd);
  const file = join(storageDir("checks", cwd), `${key.replace(/[^A-Za-z0-9=+.-]/g, "_")}.json`);
  if (!fresh && existsSync(file)) {
    try {
      return { ...JSON.parse(readFileSync(file, "utf8")), cached: true };
    } catch {}
  }
  if (!existsSync(join(cwd, pkg, "node_modules"))) {
    return {
      package: pkg, status: "error", cached: false, key, commands: [],
      message: `${pkg}/node_modules is missing: install dependencies in ${pkg}/ and re-run`,
    };
  }
  const commands = [];
  let status = "pass";
  for (const c of spec.commands) {
    const r = await runner(c.cmd, { cwd: join(cwd, pkg), timeout });
    commands.push({ name: c.name, cmd: c.cmd, code: r.code, ...(r.code === 0 ? {} : { tail: tail(r.output ?? "") }) });
    if (r.code !== 0) status = "fail";
  }
  const result = { package: pkg, status, cached: false, key, commands };
  if (status === "pass") writeFileSync(file, JSON.stringify(result));
  return result;
}

/**
 * runChecks({cwd, packages (touched), files?, config?, runner?, fresh?, tree?})
 * Failure of a command is a critical finding; missing node_modules is status "error".
 */
export async function runChecks({
  cwd = process.cwd(), packages = [], files = [], config = loadChecksConfig(),
  runner = shellRunner, fresh = false, tree,
} = {}) {
  const root = repoRoot(cwd);
  const t = tree ?? workingTree(root);
  const list = expandPackages(packages, config);
  const timeout = config.timeoutMs ?? 600000;
  const results = await Promise.all(
    list.map((p) => checkPackage(p, { cwd: root, config, runner, tree: t, fresh, timeout })),
  );
  const status = results.some((r) => r.status === "error") ? "error"
    : results.some((r) => r.status === "fail") ? "fail" : "pass";
  const recommendations = [];
  if (config.integration && files.some((f) => matchAny(f, config.integration.globs))) {
    recommendations.push(config.integration.message);
  }
  const findings = results.flatMap((r) =>
    r.commands.filter((c) => c.code !== 0).map((c) => ({
      skill: "checks", file: null, line: null, rule: `${r.package}:${c.name}`,
      severity: "critical", skillSeverity: "critical", evidence: c.tail ?? "",
      fix: `Make \`${c.cmd}\` pass in ${r.package}/`, confidence: 1, needsVerification: false,
    })),
  );
  return { status, results, findings, recommendations };
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") o.base = argv[++i];
    else if (argv[i] === "--cwd") o.cwd = argv[++i];
    else if (argv[i] === "--packages") o.packages = argv[++i].split(",").filter(Boolean);
    else if (argv[i] === "--fresh") o.fresh = true;
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = parseArgs(process.argv.slice(2));
  const cwd = o.cwd ?? process.cwd();
  let packages = o.packages, files = [];
  if (!packages) {
    const { collect } = await import("./collect.mjs");
    const c = await collect({ cwd, base: o.base ?? "origin/main", fetch: false });
    packages = c.packages;
    files = c.files;
  }
  const out = await runChecks({ cwd, packages, files, fresh: o.fresh });
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(out.status === "pass" ? 0 : 1);
}
