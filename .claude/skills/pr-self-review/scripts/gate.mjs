// PreToolUse hook: block `gh pr create` / `gh pr merge` unless a passing self-review verdict exists
// for the committed code (key = merge-base : HEAD^{tree}). Exit 0 = allow, exit 2 + stderr = block.
// There is deliberately no env-based bypass; the only legitimate bypass is a waiver in the verdict.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { repoRoot, mergeBase, headTree, verdictKey, gitTry, git } from "./lib.mjs";
import { readVerdict } from "./verdict.mjs";

const GH_RE = /\bgh\s+pr\s+(create|merge)\b/;

const tokens = (cmd) => cmd.match(/"[^"]*"|'[^']*'|\S+/g)?.map((t) => t.replace(/^(["'])(.*)\1$/, "$2")) ?? [];

/** Parse the gh invocation: { kind, base, rest } where rest are the args after `create|merge`. */
export function parseGh(command) {
  const m = GH_RE.exec(command);
  if (!m) return null;
  const t = tokens(command.slice(m.index + m[0].length).split(/&&|\|\||;|\|/)[0]);
  let base = null;
  const positional = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "--base" || t[i] === "-B") base = t[++i] ?? base;
    else if (t[i].startsWith("--base=")) base = t[i].slice(7);
    else if (t[i].startsWith("-")) {
      if (m[1] === "merge" && ["--repo", "-R"].includes(t[i])) positional.push(t[i], t[++i]);
    } else positional.push(t[i]);
  }
  return { kind: m[1], base, positional };
}

const defaultGh = (args, cwd) => execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function resolveBase(name, cwd) {
  for (const c of [`origin/${name}`, name]) if (gitTry(["rev-parse", "--verify", "-q", c], { cwd })) return c;
  return null;
}

function dirtyHint(cwd) {
  return gitTry(["status", "--porcelain"], { cwd }) ? "\nThe working copy has uncommitted changes: commit them (the gate checks committed code)." : "";
}

/** Decide for a Bash command. gh is injectable: (args, cwd) => stdout. Returns { code, message }. */
export function decide(command, { cwd = process.cwd(), gh = defaultGh } = {}) {
  const parsed = parseGh(command ?? "");
  if (!parsed) return { code: 0 };
  try {
    const root = repoRoot(cwd);
    let baseName = parsed.base ?? "main";
    let tree;
    let head = "HEAD";
    if (parsed.kind === "merge") {
      const out = JSON.parse(gh(["pr", "view", ...parsed.positional, "--json", "headRefOid,baseRefName"], root));
      if (!out.headRefOid || !out.baseRefName) throw new Error("gh pr view returned no headRefOid/baseRefName");
      baseName = out.baseRefName;
      head = out.headRefOid;
      // cat-file -e prints nothing on success, so compare with null (empty string is falsy)
      if (gitTry(["cat-file", "-e", `${head}^{commit}`], { cwd: root }) === null) {
        return { code: 2, message: `pr-self-review gate: PR head commit ${head} is not available locally. Run \`git fetch\` (or fetch the PR branch) and retry.` };
      }
    }
    tree = git(["rev-parse", `${head}^{tree}`], { cwd: root });
    const base = resolveBase(baseName, root);
    if (!base) return { code: 2, message: `pr-self-review gate: base branch '${baseName}' not found locally. Run \`git fetch origin ${baseName}\` and retry.` };
    const key = verdictKey(mergeBase(base, root, head), tree);
    const v = readVerdict(key, { cwd: root });
    if (!v) {
      return { code: 2, message: `pr-self-review gate: no self-review verdict for this code (${key}). Run /pr-self-review --quick first.${parsed.kind === "create" ? dirtyHint(root) : ""}` };
    }
    if (v.status === "pass") return { code: 0 };
    const crit = (v.criticals ?? []).map((c) => `- ${typeof c === "string" ? c : [c.path, c.title ?? c.rule ?? c.message].filter(Boolean).join(": ")}`);
    return { code: 2, message: `pr-self-review gate: verdict is "${v.status}". Fix the critical findings (or waive them) and re-run /pr-self-review.${crit.length ? "\n" + crit.join("\n") : ""}` };
  } catch (e) {
    return { code: 2, message: `pr-self-review gate: internal error, blocking gh pr ${parsed.kind}: ${e.message}` };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    // unparsable stdin: cannot know the command; nothing to gate
  }
  const r = decide(input?.tool_input?.command ?? "", { cwd: input?.cwd ?? process.cwd() });
  if (r.message) process.stderr.write(r.message + "\n");
  process.exitCode = r.code;
}
