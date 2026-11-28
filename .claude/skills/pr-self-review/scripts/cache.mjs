// Cache of reviewer findings and verifier results, plus skillHash.
// CLI (stdout is JSON only):
//   cache.mjs hash   --skill S
//   cache.mjs get    findings --skill S --mode M --path P --base-blob B --new-blob N [--fresh]
//   cache.mjs put    findings <same flags>            (JSON array of findings on stdin)
//   cache.mjs get    verify --id ID [--fresh]
//   cache.mjs put    verify --id ID                   (JSON on stdin)
//   cache.mjs prune  [--days 14]
// get prints {hit: true, value} or {hit: false}.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { storageDir, pruneAll } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const selfDir = join(here, "..");
const skillsDir = join(selfDir, "..");

const sha = (s) => createHash("sha256").update(s).digest("hex");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/**
 * Hash of: the skill's directory, reviewer-prompt.md, severity.md and the skill's
 * routing.json entry. Missing pieces hash as absent (those md files may not exist yet).
 */
export function skillHash(skill, { skillsRoot = skillsDir, self = selfDir, routing } = {}) {
  const h = createHash("sha256");
  const dir = join(skillsRoot, skill);
  h.update("dir:");
  if (existsSync(dir)) {
    for (const f of walk(dir)) h.update(`${relative(dir, f)}\0${readFileSync(f)}\0`);
  } else h.update("absent");
  for (const name of ["reviewer-prompt.md", "severity.md"]) {
    const p = join(self, name);
    h.update(`|${name}:`);
    h.update(existsSync(p) ? readFileSync(p) : "absent");
  }
  const r = routing ?? JSON.parse(readFileSync(join(self, "routing.json"), "utf8"));
  h.update("|route:" + JSON.stringify(r.skills?.[skill] ?? null));
  return h.digest("hex").slice(0, 16);
}

/** Findings cache key: skill + skillHash + mode + path + baseBlob + newBlob. */
export function findingsKey({ skill, skillHash: sh, mode, path, baseBlob, newBlob }) {
  return sha([skill, sh, mode, path, baseBlob ?? "none", newBlob ?? "none"].join("\0"));
}

function fileFor(kind, key, cwd) {
  const sub = kind === "findings" ? "findings" : "verify";
  return join(storageDir(sub, cwd), `${key}.json`);
}

export function cacheGet(kind, key, { cwd = process.cwd(), fresh = false } = {}) {
  if (fresh) return { hit: false };
  const f = fileFor(kind, key, cwd);
  if (!existsSync(f)) return { hit: false };
  try {
    return { hit: true, value: JSON.parse(readFileSync(f, "utf8")) };
  } catch {
    return { hit: false };
  }
}

export function cachePut(kind, key, value, { cwd = process.cwd() } = {}) {
  writeFileSync(fileFor(kind, key, cwd), JSON.stringify(value));
}

function parseArgs(argv) {
  const o = { _: [] };
  const map = { "--skill": "skill", "--mode": "mode", "--path": "path", "--base-blob": "baseBlob",
    "--new-blob": "newBlob", "--id": "id", "--cwd": "cwd", "--days": "days" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--fresh") o.fresh = true;
    else if (map[argv[i]]) o[map[argv[i]]] = argv[++i];
    else o._.push(argv[i]);
  }
  return o;
}

function keyFromArgs(kind, o) {
  if (kind === "verify") return sha("verify\0" + o.id);
  return findingsKey({ ...o, skillHash: skillHash(o.skill) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const o = parseArgs(process.argv.slice(2));
  const [cmd, kind] = o._;
  const cwd = o.cwd ?? process.cwd();
  const print = (v) => process.stdout.write(JSON.stringify(v) + "\n");
  if (cmd === "hash") print({ skillHash: skillHash(o.skill) });
  else if (cmd === "prune") print({ removed: pruneAll(Number(o.days ?? 14), cwd) });
  else if ((cmd === "get" || cmd === "put") && (kind === "findings" || kind === "verify")) {
    const required = kind === "verify" ? ["id"] : ["skill", "mode", "path"];
    const missing = required.filter((k) => !o[k]);
    if (missing.length) {
      process.stderr.write(JSON.stringify({ ok: false, error: `missing required args: ${missing.map((m) => "--" + m).join(", ")}` }) + "\n");
      process.exitCode = 2;
    } else {
      const key = keyFromArgs(kind, o);
      if (cmd === "get") print(cacheGet(kind, key, { cwd, fresh: o.fresh }));
      else {
        cachePut(kind, key, JSON.parse(readFileSync(0, "utf8")), { cwd });
        print({ ok: true, key });
      }
    }
  } else {
    process.stderr.write(JSON.stringify({ ok: false, error: "usage: cache.mjs hash|get|put|prune ..." }) + "\n");
    process.exitCode = 2;
  }
}
