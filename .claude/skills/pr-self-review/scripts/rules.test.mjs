import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { collect } from "./collect.mjs";
import { makeRepo } from "./test-helpers.mjs";

const WF = (pkg, extra = []) =>
  ["on:", "  pull_request:", "    paths:", `      - '${pkg}/**'`, ...extra.map((e) => `      - '${e}/**'`)].join("\n");

function base() {
  const r = makeRepo();
  r.put("server/src/a.ts", "1\n"); r.put("client/src/b.tsx", "1\n");
  r.put("server/package.json", "{}"); r.put("server/pnpm-lock.yaml", "a");
  r.put("reviewer-core/src/x.ts", "1\n");
  r.put(".github/workflows/server.yml", WF("server"));
  r.put("skills-lock.json", JSON.stringify({ skills: { zod: {} } }));
  r.put(".claude/skills/zod/SKILL.md", "z");
  r.commit("chore: init"); r.sh("branch", "base");
  return r;
}
const run = (r) => collect({ cwd: r.d, base: "base", fetch: false });
const by = (out, rule) => out.ruleFindings.filter((f) => f.rule === rule);
const done = (r) => rmSync(r.d, { recursive: true, force: true });

test("clean diff yields no findings", async () => {
  const r = base();
  r.put("server/src/a.ts", "2\n"); r.commit("fix(server): tweak");
  const out = await run(r);
  assert.deepEqual(out.ruleFindings, []); assert.deepEqual(out.signals, []);
  done(r);
});

test(".env files are critical; skillSeverity mirrors severity", async () => {
  const r = base();
  r.put("server/.env", "X=1"); r.put(".env.example", "X=");
  const f = by(await run(r), "do-not-touch-env");
  assert.equal(f.length, 1);
  assert.equal(f[0].file, "server/.env");
  assert.equal(f[0].severity, "critical"); assert.equal(f[0].skillSeverity, "critical");
  assert.equal(f[0].skill, "repo-rules");
  done(r);
});

test("secrets in added lines are flagged with line, redacted, needsVerification", async () => {
  const r = base();
  const tok = "gh" + "p_" + "a".repeat(36);
  r.put("server/src/a.ts", `1\nconst t = "${tok}";\nconst k = "AK` + `IA` + `ABCDEFGHIJKLMNOP";\n`);
  const f = by(await run(r), "secret-in-diff");
  assert.deepEqual(f.map((x) => x.line).sort(), [2, 3]);
  assert.ok(f.every((x) => x.needsVerification === true && x.severity === "critical"));
  assert.ok(!f.some((x) => x.evidence.includes(tok)));
  done(r);
});

test("a secret that was already there is not re-flagged", async () => {
  const r = base();
  r.put("server/src/a.ts", "1\nk=" + "sk-" + "b".repeat(30) + "\n"); r.commit("feat: add");
  r.sh("branch", "-f", "base"); // secret now in the base
  r.put("server/src/a.ts", "1\nk=" + "sk-" + "b".repeat(30) + "\nmore\n");
  assert.equal(by(await run(r), "secret-in-diff").length, 0);
  done(r);
});

test("vendored skill and skills-lock.json changes are high; own skill is fine", async () => {
  const r = base();
  r.put(".claude/skills/zod/SKILL.md", "changed"); r.put("skills-lock.json", "{\"skills\":{}}");
  r.put(".claude/skills/pr-self-review/SKILL.md", "mine");
  const f = by(await run(r), "vendored-skill-modified");
  assert.deepEqual(f.map((x) => x.file).sort(), [".claude/skills/zod/SKILL.md", "skills-lock.json"]);
  assert.ok(f.every((x) => x.severity === "high"));
  done(r);
});

test("lock file without package.json is high; with package.json is fine", async () => {
  const r = base();
  r.put("server/pnpm-lock.yaml", "b");
  let f = by(await run(r), "lock-without-package-json");
  assert.equal(f.length, 1); assert.equal(f[0].severity, "high");
  r.put("server/package.json", '{"a":1}');
  assert.equal(by(await run(r), "lock-without-package-json").length, 0);
  done(r);
});

test("vendor/shared changed in one copy emits a signal, in both does not", async () => {
  const r = base();
  r.put("server/src/vendor/shared/a.ts", "1");
  r.put("client/src/vendor/shared/a.ts", "1"); r.commit("chore: vendor"); r.sh("branch", "-f", "base");
  r.put("server/src/vendor/shared/a.ts", "2");
  let out = await run(r);
  assert.equal(out.signals.length, 1);
  assert.equal(out.signals[0].type, "vendor-shared-single-copy");
  assert.deepEqual(out.signals[0].files, ["server/src/vendor/shared/a.ts"]);
  r.put("client/src/vendor/shared/a.ts", "2");
  out = await run(r);
  assert.equal(out.signals.length, 0);
  done(r);
});

test("cross-package import without workflow paths is high; with paths is fine", async () => {
  const r = base();
  r.put("server/src/a.ts", '1\nimport { x } from "@devdigest/reviewer-core";\n');
  const f = by(await run(r), "cross-package-without-ci-paths");
  assert.equal(f.length, 1); assert.equal(f[0].line, 2); assert.equal(f[0].severity, "high");
  r.put(".github/workflows/server.yml", WF("server", ["reviewer-core"]));
  assert.equal(by(await run(r), "cross-package-without-ci-paths").length, 0);
  done(r);
});

test("spec-first: many files / big diff / sensitive path without spec; spec silences", async () => {
  const r = base();
  for (let i = 0; i < 6; i++) r.put(`server/src/f${i}.ts`, "x\n");
  let f = by(await run(r), "spec-first");
  assert.equal(f.length, 1); assert.equal(f[0].severity, "high");
  r.put("server/specs/feature.md", "# spec");
  assert.equal(by(await run(r), "spec-first").length, 0);
  done(r);
  const r2 = base();
  r2.put("server/src/db/migrations/0001.sql", "select 1;");
  assert.equal(by(await run(r2), "spec-first").length, 1);
  done(r2);
  const r3 = base();
  r3.put("server/src/a.ts", Array.from({ length: 200 }, (_, i) => `l${i}`).join("\n"));
  assert.equal(by(await run(r3), "spec-first").length, 1);
  done(r3);
  const r4 = base();
  r4.put("server/src/a.ts", "small\n");
  assert.equal(by(await run(r4), "spec-first").length, 0);
  done(r4);
});

test("conventional commits: bad subjects flagged as medium", async () => {
  const r = base();
  r.put("server/src/a.ts", "2\n"); r.commit("fix(server): ok");
  r.put("server/src/a.ts", "3\n"); r.commit("did some stuff");
  r.put("server/src/a.ts", "4\n"); r.commit("feat!: breaking");
  const f = by(await run(r), "conventional-commits");
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, "medium"); assert.match(f[0].evidence, /did some stuff/);
  done(r);
});
