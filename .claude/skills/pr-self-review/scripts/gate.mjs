// PreToolUse hook: block `gh pr create` / `gh pr merge` unless a passing self-review verdict exists
// for the committed code (key = merge-base : HEAD^{tree}). Exit 0 = allow, exit 2 + stderr = block.
// There is deliberately no env-based bypass; the only legitimate bypass is a waiver in the verdict.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { repoRoot, mergeBase, headTree, verdictKey, gitTry, git } from "./lib.mjs";
import { readVerdict } from "./verdict.mjs";

// Anchored to command position so text that merely mentions the phrase (commit messages, echo) is not gated.
const GH_ANCHORED = new RegExp(
  // opener: start, separators, `{`/`!`, `$(`, or a shell keyword
  String.raw`(?:^|[;&|(\n{!]|\$\(|\b(?:then|do|else|elif|if|while|until)\b)\s*` +
    // env assignments (values may be quoted)
    String.raw`(?:\w+=(?:"[^"]*"|'[^']*'|\S*)\s+)*` +
    // wrapper words, each with optional flags (and one flag argument): time -p, sudo -u x, nice -n5, command --
    String.raw`(?:(?:command|exec|env|sudo|time|nohup|nice)\s+(?:-\S*\s+(?:(?!gh\b)[\w.=-]+\s+)?|\w+=\S*\s+)*)*` +
    // binary: optional path, optional quotes / backslash
    String.raw`[\\"']?(?:\S*\/)?gh["']?\s+pr\s+(create|merge)\b`,
);
// Original unanchored match, used whenever the command wraps/evaluates other commands so nothing slips through.
const GH_LOOSE = /\bgh\s+pr\s+(create|merge)\b/;
const WRAPPED = /\b(?:ba|z|da)?sh\s+-\w*c\b|\beval\b|\bxargs\b|\$\(|`/;

/** Cut a command tail at the first separator (&&, ||, ;, |, ), newline) that is not inside quotes. */
function cutAtSeparator(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === ";" || c === "|" || c === "&" || c === ")" || c === "\n") return s.slice(0, i);
  }
  return s;
}
// Merge flags that take a value (the value must not be mistaken for the PR selector).
const MERGE_VALUE_FLAGS = new Set(["--body", "-b", "--body-file", "-F", "--subject", "-t", "--match-head-commit", "--author-email", "-A"]);

const tokens = (cmd) => cmd.match(/"[^"]*"|'[^']*'|\S+/g)?.map((t) => t.replace(/^(["'])(.*)\1$/, "$2")) ?? [];

/** Parse the gh invocation: { kind, base, positional } (positional = selector/repo args for the merge-side PR lookup). */
export function parseGh(command) {
  const m = GH_ANCHORED.exec(command) ?? (WRAPPED.test(command) ? GH_LOOSE.exec(command) : null);
  if (!m) return null;
  const t = tokens(cutAtSeparator(command.slice(m.index + m[0].length)));
  let base = null;
  let selector = null;
  let repo = null;
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    if (a === "--base" || a === "-B") base = t[++i] ?? base;
    else if (a.startsWith("--base=")) base = a.slice(7);
    else if (a === "--repo" || a === "-R") repo = t[++i] ?? repo;
    else if (a.startsWith("--repo=")) repo = a.slice(7);
    else if (MERGE_VALUE_FLAGS.has(a)) i++;
    else if (a.startsWith("-")) continue;
    else if (selector === null) selector = a;
  }
  const positional = [];
  if (m[1] === "merge") {
    if (selector !== null) positional.push(selector);
    if (repo !== null) positional.push("--repo", repo);
  }
  return { kind: m[1], base, positional };
}

const defaultGh = (args, cwd) => execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// Prefer origin/<base> (the skill's default); fall back to the local branch so offline/local-only repos still get
// a key. A different base only yields a different key, i.e. a block, never a false pass.
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
