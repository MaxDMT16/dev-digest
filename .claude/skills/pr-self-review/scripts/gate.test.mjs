import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

test("false positives pass through without a verdict", () => {
  const r = repo();
  assert.equal(run(r, 'git commit -m "docs: mention gh pr create flow"').code, 0);
  assert.equal(run(r, 'echo "run gh pr merge later"').code, 0);
  assert.equal(run(r, "cat <<'X'\nuse gh pr create here\nX").code, 0);
});

test("command-position and wrapped invocations are still gated", () => {
  const r = repo();
  for (const c of [
    "gh pr create", "FOO=1 gh pr create", "(gh pr create)", "a;gh pr create", "a && gh pr merge 5",
    'bash -c "gh pr create"', "echo hi\ngh pr create", "sudo gh pr create", "echo $(gh pr create)",
    "echo gh pr create | xargs sh -c",
  ]) assert.equal(run(r, c).code, 2, c);
});

test("evasion forms are gated (round 2)", () => {
  const r = repo();
  for (const c of [
    "/opt/homebrew/bin/gh pr create", "\\gh pr create", '"gh" pr create', "'gh' pr create",
    "if x; then gh pr create; fi", "{ gh pr create; }", "! gh pr create", "while true; do gh pr merge 5; done",
    "time -p gh pr create", "command -- gh pr create", "env -i gh pr create", "sudo -u x gh pr create",
    "nohup gh pr create", "nice -n5 gh pr create", 'FOO="a b" gh pr create', 'bash -lc "gh pr create"',
    "env -i FOO=1 gh pr create",
  ]) assert.equal(run(r, c).code, 2, c);
});

test("no catastrophic backtracking; correct result on long prefixes", () => {
  const cases = [
    ["sudo " + "-a ".repeat(300) + "gh pr create", "create"],
    ["env " + "A=1 ".repeat(300) + "gh pr merge 5", "merge"],
    ["sudo " + "-a ".repeat(300) + "x", null],
    ["env " + "-i A=1 ".repeat(150) + "echo hi", null],
    ["sh " + "-x ".repeat(300) + "-c 'gh pr create'", "create"],
    ["sh " + "-x ".repeat(300) + "echo", null],
  ];
  for (const [c, kind] of cases) {
    const t0 = Date.now();
    const p = parseGh(c);
    assert.ok(Date.now() - t0 < 500, "slow: " + c.slice(0, 30));
    assert.equal(p?.kind ?? null, kind, c.slice(0, 30));
  }
});

test("linear time on adversarial prefixes (round 4); correct result", () => {
  const prefixes = ["sudo -a ".repeat(3000), "env A=1 -i ".repeat(3000), 'A="x" '.repeat(3000), "sudo ".repeat(3000)];
  const cases = [];
  for (const p of prefixes) cases.push([p + "gh pr create", "create"], [p + "gh pr merge 5", "merge"], [p + "x", null]);
  cases.push(
    ["sh ".repeat(10000) + "-c 'gh pr create'", "create"],
    ["sh ".repeat(10000) + "echo", null],
    ["sh ".repeat(10000) + "echo gh pr create", null],
    [";".repeat(10000) + "gh pr merge 5", "merge"],
    ['"'.repeat(10000) + "; gh pr create", "create"],
    ["'".repeat(10001) + " ; gh pr create", "create"], // unbalanced quote: the quote-blind pass still sees it
    ["A=" + '"'.repeat(10001) + " x", null],
  );
  for (const [c, kind] of cases) {
    const t0 = Date.now();
    const p = parseGh(c);
    assert.ok(Date.now() - t0 < 500, "slow: " + c.slice(0, 30));
    assert.equal(p?.kind ?? null, kind, c.slice(0, 30));
  }
});

test("tokenizer: more gated forms and pass-through mentions (round 4)", () => {
  for (const c of [
    'FOO="a;b" gh pr create', 'g"h" pr create', 'gh "pr" create', "2>/dev/null gh pr create", "> out gh pr create",
    "/usr/bin/env -i gh pr create", "cat <<X\ndon't\nX\ngh pr create", "gh pr -R o/r merge 5", "sudo -E nice -n 5 gh pr merge 5",
    "if ! gh pr create; then :; fi", "gh \\\n  pr create",
  ]) assert.notEqual(parseGh(c), null, c);
  for (const c of [
    "echo then gh pr create", 'git commit -m "then gh pr create"', "grep -rn 'gh pr merge' .", "rg gh pr create",
    "git log --grep 'gh pr create'", "printf '%s\\n' gh pr merge",
  ]) assert.equal(parseGh(c), null, c);
  assert.deepEqual(parseGh("gh pr -R o/r merge 5").positional, ["5", "--repo", "o/r"]);
  assert.equal(parseGh("cd x && gh pr create --base dev").base, "dev");
});

test("shell wrappers with extra flags are gated", () => {
  const r = repo();
  for (const c of ['bash -x -c "gh pr create"', 'bash --norc -c "gh pr create"', 'sh -ec "gh pr merge 5"']) {
    assert.equal(run(r, c).code, 2, c);
  }
});

test("mentions with keywords-free text still pass through", () => {
  const r = repo();
  assert.equal(run(r, 'git commit -m "feat: gate gh pr create without verdict"').code, 0);
  assert.equal(run(r, "echo gh pr merge is blocked").code, 0);
});

test("merge: separators inside quotes do not cut args", () => {
  assert.deepEqual(parseGh('gh pr merge --body "fix; done" 5').positional, ["5"]);
  assert.deepEqual(parseGh("gh pr merge 5 && echo hi").positional, ["5"]);
  assert.equal(parseGh('gh pr create --title "a | b" --base dev').base, "dev");
});

test("merge: flag values do not leak into the selector", () => {
  assert.deepEqual(parseGh('gh pr merge 5 --squash --body "msg"').positional, ["5"]);
  assert.deepEqual(parseGh('gh pr merge --body "msg" 5 -R o/r').positional, ["5", "--repo", "o/r"]);
  assert.deepEqual(parseGh("gh pr merge --squash").positional, []);
});

test("malformed stdin JSON exits 0", () => {
  const p = spawnSync("node", [here + "gate.mjs"], { input: "not json", encoding: "utf8" });
  assert.equal(p.status, 0);
});

test("corrupt verdict file blocks", () => {
  const r = repo();
  store(r, "pass");
  const dir = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: r.d, encoding: "utf8" }).trim();
  const vd = join(r.d, dir, "pr-self-review", "verdicts");
  for (const f of readdirSync(vd)) writeFileSync(join(vd, f), "{broken");
  assert.equal(run(r, "gh pr create").code, 2);
});

test("base falls back to the local branch when origin/<base> is absent", () => {
  const r = repo(); // no remote at all
  store(r, "pass");
  assert.equal(run(r, "gh pr create --base main").code, 0);
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
