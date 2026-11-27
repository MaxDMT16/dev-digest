import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { makeRepo } from "./test-helpers.mjs";
import { runChecks, expandPackages, loadChecksConfig } from "./checks.mjs";

const config = {
  packages: {
    server: { commands: [{ name: "typecheck", cmd: "tc" }, { name: "test", cmd: "t" }], alsoChecks: [] },
    core: { commands: [{ name: "typecheck", cmd: "tc" }], alsoChecks: ["server"] },
  },
  keyDeps: { server: ["core"] },
  integration: { globs: ["server/src/db/**"], message: "run integration" },
};

function setup(withModules = true) {
  const r = makeRepo();
  r.put("server/a.ts", "1"); r.put("core/b.ts", "1"); r.commit("init");
  if (withModules) for (const p of ["server", "core"]) mkdirSync(join(r.d, p, "node_modules"), { recursive: true });
  return r;
}
const fakeRunner = (calls, fail = () => false) => async (cmd, { cwd }) => {
  calls.push(`${cwd.split("/").pop()}:${cmd}`);
  return fail(cmd, cwd) ? { code: 1, output: "boom" } : { code: 0, output: "ok" };
};

test("real checks.json is valid and references known packages", () => {
  const c = loadChecksConfig();
  for (const [p, s] of Object.entries(c.packages)) {
    assert.ok(s.commands.length);
    for (const d of s.alsoChecks) assert.ok(c.packages[d], `${p} -> ${d}`);
  }
});

test("expandPackages adds alsoChecks and drops unknown", () => {
  assert.deepEqual(expandPackages(["core", "nope"], config).sort(), ["core", "server"]);
});

test("pass, cache hit on rerun, fresh bypasses cache", async () => {
  const r = setup();
  const calls = [];
  const a = await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  assert.equal(a.status, "pass");
  assert.equal(calls.length, 2);
  const b = await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  assert.equal(b.results[0].cached, true);
  assert.equal(calls.length, 2);
  await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls), fresh: true });
  assert.equal(calls.length, 4);
});

test("dependency change invalidates cache; unrelated change does not", async () => {
  const r = setup();
  const calls = [];
  await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  r.put("core/b.ts", "2");
  const dep = await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  assert.equal(dep.results[0].cached, false);
  r.put("other/x.ts", "2");
  const same = await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  assert.equal(same.results[0].cached, true);
});

test("failure yields critical finding with output tail and is not cached", async () => {
  const r = setup();
  const calls = [];
  const bad = await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls, (c) => c === "t") });
  assert.equal(bad.status, "fail");
  assert.equal(bad.findings.length, 1);
  assert.equal(bad.findings[0].severity, "critical");
  assert.match(bad.findings[0].evidence, /boom/);
  const again = await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  assert.equal(again.status, "pass");
});

test("alsoChecks runs dependent package; missing node_modules is error", async () => {
  const r = setup();
  const calls = [];
  const res = await runChecks({ cwd: r.d, packages: ["core"], config, runner: fakeRunner(calls) });
  assert.equal(res.results.length, 2);
  const r2 = setup(false);
  const err = await runChecks({ cwd: r2.d, packages: ["server"], config, runner: fakeRunner([]) });
  assert.equal(err.status, "error");
  assert.match(err.results[0].message, /node_modules/);
});

test("integration recommendation for db files", async () => {
  const r = setup();
  const res = await runChecks({ cwd: r.d, packages: ["server"], files: ["server/src/db/x.ts"], config, runner: fakeRunner([]) });
  assert.deepEqual(res.recommendations, ["run integration"]);
});

test("shellRunner times out quickly and kills grandchildren holding the pipes", async () => {
  const { shellRunner } = await import("./checks.mjs");
  const t0 = Date.now();
  const r = await shellRunner("sh -c 'sleep 30' & sleep 30", { cwd: process.cwd(), timeout: 300 });
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(r.code, 124);
  assert.equal(r.timedOut, true);
  assert.match(r.output, /timed out/);
});

test("editing the command list invalidates the cached pass", async () => {
  const r = setup();
  const calls = [];
  await runChecks({ cwd: r.d, packages: ["server"], config, runner: fakeRunner(calls) });
  const edited = { ...config, packages: { ...config.packages, server: { ...config.packages.server, commands: [{ name: "typecheck", cmd: "tc2" }] } } };
  const res = await runChecks({ cwd: r.d, packages: ["server"], config: edited, runner: fakeRunner(calls) });
  assert.equal(res.results[0].cached, false);
});
