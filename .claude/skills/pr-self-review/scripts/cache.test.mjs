import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { makeRepo } from "./test-helpers.mjs";
import { skillHash, findingsKey, cacheGet, cachePut } from "./cache.mjs";

const here = new URL(".", import.meta.url).pathname;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "psr-skills-"));
  const self = join(root, "pr-self-review");
  mkdirSync(join(root, "zod"), { recursive: true });
  mkdirSync(self, { recursive: true });
  writeFileSync(join(root, "zod", "SKILL.md"), "v1");
  return { skillsRoot: root, self, routing: { skills: { zod: { globs: ["a"] } } } };
}

test("skillHash is stable, tolerates missing md files, and reacts to each input", () => {
  const f = fixture();
  const h0 = skillHash("zod", f);
  assert.equal(skillHash("zod", f), h0);
  writeFileSync(join(f.skillsRoot, "zod", "SKILL.md"), "v2");
  const h1 = skillHash("zod", f);
  assert.notEqual(h1, h0);
  writeFileSync(join(f.self, "severity.md"), "x");
  const h2 = skillHash("zod", f);
  assert.notEqual(h2, h1);
  writeFileSync(join(f.self, "reviewer-prompt.md"), "y");
  const h3 = skillHash("zod", f);
  assert.notEqual(h3, h2);
  assert.notEqual(skillHash("zod", { ...f, routing: { skills: { zod: { globs: ["b"] } } } }), h3);
});

test("findings hit/miss by blob, skillHash, mode; --fresh ignores cache", () => {
  const r = makeRepo();
  r.put("a", "1"); r.commit("i");
  const base = { skill: "zod", skillHash: "h", mode: "full", path: "a.ts", baseBlob: "b1", newBlob: "n1" };
  const k = findingsKey(base);
  assert.equal(cacheGet("findings", k, { cwd: r.d }).hit, false);
  cachePut("findings", k, [{ rule: "x" }], { cwd: r.d });
  assert.deepEqual(cacheGet("findings", k, { cwd: r.d }), { hit: true, value: [{ rule: "x" }] });
  assert.equal(cacheGet("findings", k, { cwd: r.d, fresh: true }).hit, false);
  for (const change of [{ newBlob: "n2" }, { baseBlob: "b2" }, { skillHash: "h2" }, { mode: "quick" }, { path: "b.ts" }, { skill: "security" }]) {
    assert.equal(cacheGet("findings", findingsKey({ ...base, ...change }), { cwd: r.d }).hit, false, JSON.stringify(change));
  }
});

test("CLI put/get findings and verify, hash and prune; stdout is JSON", () => {
  const r = makeRepo();
  r.put("a", "1"); r.commit("i");
  const run = (args, input) => execFileSync("node", [join(here, "cache.mjs"), ...args, "--cwd", r.d], { input, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
  const f = ["findings", "--skill", "zod", "--mode", "full", "--path", "p.ts", "--base-blob", "b", "--new-blob", "n"];
  assert.equal(JSON.parse(run(["get", ...f])).hit, false);
  run(["put", ...f], JSON.stringify([{ a: 1 }]));
  assert.deepEqual(JSON.parse(run(["get", ...f])).value, [{ a: 1 }]);
  assert.equal(JSON.parse(run(["get", ...f, "--fresh"])).hit, false);
  run(["put", "verify", "--id", "F1"], JSON.stringify({ refuted: false }));
  assert.deepEqual(JSON.parse(run(["get", "verify", "--id", "F1"])).value, { refuted: false });
  assert.equal(JSON.parse(run(["get", "verify", "--id", "F2"])).hit, false);
  assert.match(JSON.parse(run(["hash", "--skill", "zod"])).skillHash, /^[0-9a-f]{16}$/);
  assert.equal(JSON.parse(run(["prune"])).removed, 0);
});
