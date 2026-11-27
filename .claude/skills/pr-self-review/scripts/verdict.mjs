// Write/read the self-review verdict, re-checking that the code did not change meanwhile.
// CLI: node verdict.mjs write --key <mergeBase:tree> [--base origin/main] [--cwd dir]   (verdict JSON on stdin)
//      node verdict.mjs read  --key <key> [--cwd dir]
// Exit 0 + JSON {ok:true,...} on success; exit 1 + {ok:false,error} on refusal.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot, workingTree, mergeBase, verdictKey, storageDir } from "./lib.mjs";

const fileFor = (key, cwd) => join(storageDir("verdicts", cwd), `${key.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);

/** The stored verdict for key, or null. */
export function readVerdict(key, { cwd = process.cwd() } = {}) {
  const f = fileFor(key, cwd);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}

/** Current key of the working copy against base. */
export function currentKey({ cwd = process.cwd(), base = "origin/main" } = {}) {
  const root = repoRoot(cwd);
  return verdictKey(mergeBase(base, root), workingTree(root));
}

/** Validate, re-compute the key, refuse on mismatch, else persist. */
export function writeVerdict(verdict, key, { cwd = process.cwd(), base } = {}) {
  if (!verdict || !["pass", "blocked"].includes(verdict.status)) {
    return { ok: false, error: "verdict.status must be 'pass' or 'blocked'" };
  }
  const b = base ?? verdict.base ?? "origin/main";
  let now;
  try {
    now = currentKey({ cwd, base: b });
  } catch (e) {
    return { ok: false, error: `cannot compute current key: ${e.message}` };
  }
  if (now !== key) {
    return { ok: false, error: "key mismatch: the code changed during the review, re-run it", expected: key, actual: now };
  }
  const full = { ...verdict, key, createdAt: verdict.createdAt ?? new Date().toISOString() };
  writeFileSync(fileFor(key, cwd), JSON.stringify(full, null, 2));
  return { ok: true, key, status: full.status };
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--key") o.key = argv[++i];
    else if (argv[i] === "--base") o.base = argv[++i];
    else if (argv[i] === "--cwd") o.cwd = argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = parseArgs(process.argv.slice(2));
  const cwd = o.cwd ?? process.cwd();
  const print = (v) => process.stdout.write(JSON.stringify(v) + "\n");
  if (o._[0] === "write" && o.key) {
    const r = writeVerdict(JSON.parse(readFileSync(0, "utf8")), o.key, { cwd, base: o.base });
    print(r);
    process.exit(r.ok ? 0 : 1);
  } else if (o._[0] === "read" && o.key) {
    const v = readVerdict(o.key, { cwd });
    print(v ?? { ok: false, error: "no verdict for key" });
    process.exit(v ? 0 : 1);
  } else {
    process.stderr.write("usage: verdict.mjs write|read --key <key> [--base b] [--cwd d]\n");
    process.exit(2);
  }
}
