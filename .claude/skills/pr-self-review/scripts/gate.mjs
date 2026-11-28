// PreToolUse hook: block `gh pr create` / `gh pr merge` unless a passing self-review verdict exists
// for the committed code (key = merge-base : HEAD^{tree}). Exit 0 = allow, exit 2 + stderr = block.
// There is deliberately no env-based bypass; the only legitimate bypass is a waiver in the verdict.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { repoRoot, mergeBase, headTree, verdictKey, gitTry, git } from "./lib.mjs";
import { readVerdict } from "./verdict.mjs";

// Command matching is imperative and linear-time (no nested-quantifier regex, so no ReDoS):
// the command is split into simple commands (twice: once ignoring quotes, once quote-aware; a hit in either gates),
// and each one is walked from its first word: shell keywords, env assignments, redirections and wrapper words
// (with their flags) are skipped, then the binary must be gh (any path/quoting) followed by `pr create|merge`.
// So text that merely mentions the phrase (commit messages, echo, heredocs) is not gated.
const KEYWORDS = new Set(["then", "do", "else", "elif", "if", "while", "until", "!", "{"]);
const WRAPPERS = new Set(["command", "exec", "env", "sudo", "time", "nohup", "nice"]);
const SHELLS = /^(?:ba|z|da|k|mk|a|c|tc|fi)?sh$/;
const ASSIGN = /^[A-Za-z_]\w*\+?=/;
const REDIR = /^(?:\d+|&)?(?:>>?|<<?|>&|<&|>\|)/;
// Original unanchored match, used whenever the command wraps/evaluates other commands so nothing slips through.
const GH_LOOSE = /\bgh\s+pr\s+(create|merge)\b/;
const EVALS = /\beval\b|\bxargs\b|\$\(|`/;

const basename = (w) => w.slice(w.lastIndexOf("/") + 1);
const isSpace = (c) => c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v";

/** Is cmd[i] a command separator (; & | ( ) newline backtick)? `&`/`|` that belong to a redirection are not. */
function isSep(cmd, i) {
  const c = cmd[i];
  if (c === "&") return !(cmd[i - 1] === ">" || cmd[i - 1] === "<" || cmd[i + 1] === ">");
  if (c === "|") return cmd[i - 1] !== ">";
  return c === ";" || c === "(" || c === ")" || c === "\n" || c === "`";
}

/** Simple commands ignoring quotes (conservative: survives unbalanced quotes / heredoc bodies). Words: { v, end }. */
function looseCommands(cmd) {
  const out = [];
  let words = [];
  let start = -1;
  const word = (i) => {
    if (start >= 0) words.push({ v: cmd.slice(start, i).replace(/["'\\]/g, ""), end: i });
    start = -1;
  };
  for (let i = 0; i < cmd.length; i++) {
    if (isSep(cmd, i)) { word(i); out.push(words); words = []; }
    else if (isSpace(cmd[i])) word(i);
    else if (start < 0) start = i;
  }
  word(cmd.length);
  out.push(words);
  return out;
}

/** Simple commands with shell quoting applied (quoted env values, "gh", g\h, separators inside quotes). */
function shellCommands(cmd) {
  const out = [];
  let words = [];
  let cur = null;
  let q = null;
  const word = (i) => {
    if (cur !== null) words.push({ v: cur, end: i });
    cur = null;
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q === "'") { if (c === "'") q = null; else cur += c; continue; }
    if (q === '"') {
      if (c === '"') q = null;
      else if (c === "\\" && i + 1 < cmd.length) cur += cmd[++i];
      else cur += c;
      continue;
    }
    if (c === "\\") {
      if (cmd[i + 1] !== "\n") cur = (cur ?? "") + (cmd[i + 1] ?? ""); // backslash-newline is a line continuation
      i++;
    } else if (c === "'" || c === '"') { q = c; cur ??= ""; }
    else if (isSep(cmd, i)) { word(i); out.push(words); words = []; }
    else if (isSpace(c)) word(i);
    else cur = (cur ?? "") + c;
  }
  word(cmd.length);
  out.push(words);
  return out;
}

/** Match `gh [flags] pr [flags] create|merge` at the start of one simple command. Linear in its word count. */
function matchCommand(words) {
  const n = words.length;
  let i = 0;
  let wrapper = false;
  while (i < n) {
    const v = words[i].v;
    if (KEYWORDS.has(v) || ASSIGN.test(v)) i++;
    else if (REDIR.test(v)) i += v.replace(REDIR, "") === "" ? 2 : 1; // `> f` vs `>f` / `2>&1`
    else if (WRAPPERS.has(basename(v))) { wrapper = true; i++; }
    else if (wrapper && v.startsWith("-")) {
      // wrapper flag, plus at most one flag argument (sudo -u x, nice -n 5); never swallow gh/a wrapper/an assignment
      i++;
      const a = words[i]?.v;
      if (a !== undefined && !a.startsWith("-") && !ASSIGN.test(a) && !WRAPPERS.has(basename(a)) && basename(a) !== "gh") i++;
    } else break;
  }
  if (i >= n || basename(words[i].v) !== "gh") return null;
  i++;
  let repo = null;
  const skipFlags = () => {
    while (i < n && words[i].v.startsWith("-")) {
      const f = words[i++].v;
      if ((f === "-R" || f === "--repo") && i < n) repo = words[i++].v;
      else if (f.startsWith("--repo=")) repo = f.slice(7);
    }
  };
  skipFlags();
  if (words[i]?.v !== "pr") return null;
  i++;
  skipFlags();
  const kind = words[i]?.v;
  if (kind !== "create" && kind !== "merge") return null;
  return { kind, end: words[i].end, repo };
}

/** Does the command run text through another shell (sh -c, bash -lc, eval, xargs, $(...), backticks)? */
function isWrapped(command, loose) {
  if (EVALS.test(command)) return true;
  for (const words of loose) {
    let shell = false;
    for (const { v } of words) {
      if (shell && /^-[A-Za-z]*c/.test(v)) return true;
      if (SHELLS.test(basename(v))) shell = true;
    }
  }
  return false;
}

/** Find the gated gh invocation: { kind, end (index after create/merge), repo (-R before the subcommand) } or null. */
function findGh(command) {
  const loose = looseCommands(command);
  let best = null;
  for (const cmds of [loose, shellCommands(command)]) {
    for (const words of cmds) {
      const m = matchCommand(words);
      if (m && (!best || m.end < best.end)) best = m;
    }
  }
  if (best) return best;
  if (!isWrapped(command, loose)) return null;
  const m = GH_LOOSE.exec(command);
  return m ? { kind: m[1], end: m.index + m[0].length, repo: null } : null;
}

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
  const m = findGh(command);
  if (!m) return null;
  const t = tokens(cutAtSeparator(command.slice(m.end)));
  let base = null;
  let selector = null;
  let repo = m.repo;
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
  if (m.kind === "merge") {
    if (selector !== null) positional.push(selector);
    if (repo !== null) positional.push("--repo", repo);
  }
  return { kind: m.kind, base, positional };
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
