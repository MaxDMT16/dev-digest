import type { SkillListItem } from "@devdigest/shared";
import { SKILL_TABS, type SkillTab } from "./constants";

/** Case-insensitive filter over a skill's name + description. */
export function filterSkills(skills: SkillListItem[], search: string): SkillListItem[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q));
}

/** Rough token estimate (≈ chars / 4), same rule the server uses for its length warning. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** 0.742 → "74"; null → null (no data yet). */
export function pct(rate: number | null | undefined): string | null {
  return rate == null ? null : String(Math.round(rate * 100));
}

export function parseTab(raw: string | null | undefined): SkillTab {
  return (SKILL_TABS as readonly string[]).includes(raw ?? "") ? (raw as SkillTab) : "config";
}

/** ArrayBuffer → base64 without blowing the call stack on larger files. */
export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/** Line diff via longest-common-subsequence. Pure; used by the Versions tab. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i++]! });
    } else {
      out.push({ kind: "add", text: b[j++]! });
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i++]! });
  while (j < m) out.push({ kind: "add", text: b[j++]! });
  return out;
}
