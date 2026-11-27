import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { makeRepo } from "./test-helpers.mjs";
import { writeVerdict, currentKey } from "./verdict.mjs";
import { decide, parseGh } from "./gate.mjs";

const here = new URL(".", import.meta.url).pathname;

function repo() {
  const r = makeRepo();
  r.put("a.ts", "1"); r.commit("base");
  r.sh("checkout", "-q", "-b", "feat");
  r.put("a.ts", "2"); r.commit("change");
  return r;
}
const run = (r, command) => {
  const p = spawnSync("node", [here + "gate.mjs"], {
    input: JSON.stringify({ tool_input: { command }, cwd: r.d }),
    encoding: "utf8",
  });
  return { code: p.status, stderr: p.stderr };
};
const store = (r, status, extra = {}) => {
  const key = currentKey({ cwd: r.d, base: "main" });
  assert.equal(writeVerdict({ status, base: "main", criticals: [], ...extra }, key, { cwd: r.d, base: "main" }).ok, true);
};

test("non-gh command passes", () => {
  const r = repo();
  assert.equal(run(r, "git status").code, 0);
  assert.equal(run(r, "gh pr view 1").code, 0);
});

test("create without verdict blocks", () => {
  const r = repo();
  const o = run(r, "gh pr create --title x");
  assert.equal(o.code, 2);
  assert.match(o.stderr, /pr-self-review --quick/);
});

test("dirty working copy adds a commit hint", () => {
  const r = repo();
  r.put("b.ts", "x");
  assert.match(run(r, "gh pr create").stderr, /commit/i);
});

test("blocked verdict blocks and lists criticals", () => {
  const r = repo();
  store(r, "blocked", { criticals: [{ path: "a.ts", title: "SQL injection" }] });
  const o = run(r, "gh pr create");
  assert.equal(o.code, 2);
  assert.match(o.stderr, /SQL injection/);
});

test("pass verdict allows, also when chained after other commands", () => {
  const r = repo();
  store(r, "pass");
  assert.equal(run(r, "gh pr create --base main").code, 0);
  assert.equal(run(r, "git push && gh pr create -B main").code, 0);
});

test("pass verdict is stale after a new commit", () => {
  const r = repo();
  store(r, "pass");
  r.put("a.ts", "3"); r.commit("more");
  assert.equal(run(r, "gh pr create").code, 2);
});

test("unknown base blocks (fail closed)", () => {
  const r = repo();
  assert.equal(run(r, "gh pr create --base nope").code, 2);
});

test("parseGh extracts base and selector", () => {
  assert.equal(parseGh("gh pr create --base=dev").base, "dev");
  assert.equal(parseGh("gh pr create -B dev").base, "dev");
  assert.deepEqual(parseGh("gh pr merge 12 --squash").positional, ["12"]);
  assert.equal(parseGh("echo hi"), null);
});

test("merge: uses gh head/base (injected runner), tree of that commit", () => {
  const r = repo();
  store(r, "pass");
  const oid = execFileSync("git", ["rev-parse", "HEAD"], { cwd: r.d, encoding: "utf8" }).trim();
  const calls = [];
  const gh = (args) => { calls.push(args); return JSON.stringify({ headRefOid: oid, baseRefName: "main" }); };
  r.sh("checkout", "-q", "main"); // working copy elsewhere; verdict is for the PR head commit
  assert.equal(decide("gh pr merge 5 --squash", { cwd: r.d, gh }).code, 0);
  assert.deepEqual(calls[0], ["pr", "view", "5", "--json", "headRefOid,baseRefName"]);
});

test("merge: missing commit locally blocks with fetch hint; gh failure blocks", () => {
  const r = repo();
  const gh = () => JSON.stringify({ headRefOid: "deadbeef".repeat(5), baseRefName: "main" });
  const d = decide("gh pr merge 5", { cwd: r.d, gh });
  assert.equal(d.code, 2);
  assert.match(d.message, /git fetch/);
  const bad = decide("gh pr merge 5", { cwd: r.d, gh: () => { throw new Error("no network"); } });
  assert.equal(bad.code, 2);
  assert.match(bad.message, /internal error/);
});

test("merge: no verdict for head commit blocks", () => {
  const r = repo();
  const oid = execFileSync("git", ["rev-parse", "HEAD"], { cwd: r.d, encoding: "utf8" }).trim();
  const gh = () => JSON.stringify({ headRefOid: oid, baseRefName: "main" });
  assert.equal(decide("gh pr merge", { cwd: r.d, gh }).code, 2);
});

test(".claude/settings.json registers the hook and is not git-ignored", () => {
  const root = new URL("../../../../", import.meta.url).pathname;
  const s = JSON.parse(readFileSync(root + ".claude/settings.json", "utf8"));
  const e = s.hooks.PreToolUse[0];
  assert.equal(e.matcher, "Bash");
  assert.equal(e.hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/.claude/skills/pr-self-review/scripts/gate.mjs"');
  const ig = spawnSync("git", ["check-ignore", "-q", ".claude/settings.json"], { cwd: root });
  assert.equal(ig.status, 1);
});
