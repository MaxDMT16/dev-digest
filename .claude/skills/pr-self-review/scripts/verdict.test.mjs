import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { makeRepo } from "./test-helpers.mjs";
import { writeVerdict, readVerdict, currentKey } from "./verdict.mjs";

const here = new URL(".", import.meta.url).pathname;

function repo() {
  const r = makeRepo();
  r.put("a.ts", "1"); r.commit("base");
  r.sh("checkout", "-q", "-b", "feat");
  r.put("a.ts", "2");
  return r;
}
const v = (extra = {}) => ({ status: "pass", mode: "full", base: "main", criticals: [], waivers: [], ...extra });

test("write succeeds with current key and readVerdict returns it", () => {
  const r = repo();
  const key = currentKey({ cwd: r.d, base: "main" });
  assert.equal(readVerdict(key, { cwd: r.d }), null);
  const res = writeVerdict(v(), key, { cwd: r.d });
  assert.equal(res.ok, true);
  const got = readVerdict(key, { cwd: r.d });
  assert.equal(got.status, "pass");
  assert.equal(got.key, key);
  assert.ok(got.createdAt);
});

test("write refuses when code changed after the key was taken", () => {
  const r = repo();
  const key = currentKey({ cwd: r.d, base: "main" });
  r.put("a.ts", "3");
  const res = writeVerdict(v(), key, { cwd: r.d });
  assert.equal(res.ok, false);
  assert.match(res.error, /key mismatch/);
  assert.equal(readVerdict(key, { cwd: r.d }), null);
});

test("key stays valid after committing the reviewed changes", () => {
  const r = repo();
  const key = currentKey({ cwd: r.d, base: "main" });
  r.commit("feat");
  assert.equal(writeVerdict(v(), key, { cwd: r.d }).ok, true);
});

test("rejects invalid status", () => {
  const r = repo();
  const key = currentKey({ cwd: r.d, base: "main" });
  assert.equal(writeVerdict({ status: "maybe" }, key, { cwd: r.d }).ok, false);
});

test("CLI write via stdin: exit 0 then exit 1 on mismatch, stdout JSON", () => {
  const r = repo();
  const key = currentKey({ cwd: r.d, base: "main" });
  const run = () => spawnSync("node", [join(here, "verdict.mjs"), "write", "--key", key, "--cwd", r.d], { input: JSON.stringify(v()), encoding: "utf8" });
  const ok = run();
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).ok, true);
  r.put("a.ts", "9");
  const bad = run();
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stdout).ok, false);
  const rd = execFileSync("node", [join(here, "verdict.mjs"), "read", "--key", key, "--cwd", r.d], { encoding: "utf8" });
  assert.equal(JSON.parse(rd).status, "pass");
});
