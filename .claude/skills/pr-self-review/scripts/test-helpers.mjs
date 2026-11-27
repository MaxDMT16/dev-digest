import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

/** Temp git repo on branch main; returns { d, sh, put, commit }. */
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
