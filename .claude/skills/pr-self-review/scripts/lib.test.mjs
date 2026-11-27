import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  git, workingTree, headTree, subtreeSha, packageKey, storageDir, prune, matchAny, mergeBase, blobSha,
} from "./lib.mjs";

export function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), "psr-test-"));
  const sh = (...a) => execFileSync("git", a, { cwd: d, stdio: "pipe" });
  sh("init", "-q", "-b", "main");
  sh("config", "user.email", "t@t"); sh("config", "user.name", "t");
  sh("config", "commit.gpgsign", "false");
  const put = (p, c) => { mkdirSync(join(d, p, ".."), { recursive: true }); writeFileSync(join(d, p), c); };
  const commit = (m) => { sh("add", "-A"); sh("commit", "-q", "-m", m); };
  return { d, sh, put, commit };
}

test("working tree key equals HEAD tree after commit; real index untouched", () => {
  const r = makeRepo();
  r.put("server/src/a.ts", "a"); r.commit("init");
  r.put("server/src/a.ts", "b"); r.put("client/new.ts", "n"); // unstaged + untracked
  const before = git(["status", "--porcelain"], { cwd: r.d });
  const wt = workingTree(r.d);
  assert.notEqual(wt, headTree(r.d));
  assert.equal(git(["status", "--porcelain"], { cwd: r.d }), before);
  r.commit("change");
  assert.equal(workingTree(r.d), headTree(r.d));
  rmSync(r.d, { recursive: true, force: true });
});

test("package key changes only with own subtree or deps", () => {
  const r = makeRepo();
  r.put("server/a.ts", "1"); r.put("reviewer-core/b.ts", "1"); r.put("client/c.ts", "1");
  r.commit("init");
  const deps = { server: ["reviewer-core"] };
  const k0 = { s: packageKey(workingTree(r.d), "server", deps, r.d), c: packageKey(workingTree(r.d), "client", deps, r.d) };
  r.put("client/c.ts", "2");
  assert.equal(packageKey(workingTree(r.d), "server", deps, r.d), k0.s);
  assert.notEqual(packageKey(workingTree(r.d), "client", deps, r.d), k0.c);
  r.put("reviewer-core/b.ts", "2");
  assert.notEqual(packageKey(workingTree(r.d), "server", deps, r.d), k0.s);
  assert.equal(subtreeSha(headTree(r.d), "nope", r.d), null);
  assert.ok(blobSha("HEAD", "server/a.ts", r.d));
  rmSync(r.d, { recursive: true, force: true });
});

test("storageDir lives under git-common-dir and prune removes old entries", () => {
  const r = makeRepo();
  r.put("a", "1"); r.commit("init");
  const dir = storageDir("verdicts", r.d);
  assert.ok(dir.includes(".git"));
  writeFileSync(join(dir, "old"), "x"); writeFileSync(join(dir, "new"), "x");
  const old = new Date(Date.now() - 15 * 86400_000);
  utimesSync(join(dir, "old"), old, old);
  assert.equal(prune(dir, 14), 1);
  assert.ok(!existsSync(join(dir, "old")) && existsSync(join(dir, "new")));
  rmSync(r.d, { recursive: true, force: true });
});

test("matchAny and mergeBase", () => {
  assert.ok(matchAny("client/src/a/b.tsx", ["client/src/**/*.{ts,tsx}"]));
  assert.ok(!matchAny("server/src/a.ts", ["client/src/**"]));
  assert.ok(matchAny("README.md", ["**/*.md"]));
  assert.ok(matchAny(".claude/skills/README.md", ["**/*.md"]));
  assert.ok(matchAny(".github/workflows/ci.yml", [".github/workflows/**"]));
  assert.ok(matchAny(".env.example", [".env.example"]));
  const r = makeRepo();
  r.put("a", "1"); r.commit("init"); r.sh("branch", "base");
  r.put("a", "2"); r.commit("two");
  assert.equal(mergeBase("base", r.d), git(["rev-parse", "base"], { cwd: r.d }));
  rmSync(r.d, { recursive: true, force: true });
});
