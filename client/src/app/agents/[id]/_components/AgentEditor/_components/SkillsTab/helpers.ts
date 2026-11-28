import type { AgentSkillLink, SkillListItem } from "@devdigest/shared";

/** One line of the agent's Skills tab. */
export interface SkillRowModel {
  skill: SkillListItem;
  /** Attached to this agent (has a position in the prompt order). */
  linked: boolean;
  /** Enabled for THIS agent (independent of the skill's global flag). */
  enabled: boolean;
}

/** What gets sent to `PUT /agents/:id/skills`: the full ordered set; index = order. */
export interface SkillItem {
  skill_id: string;
  enabled: boolean;
}

/** Linked skills first (in link order), then unlinked ones by name. */
export function buildRows(skills: SkillListItem[], links: AgentSkillLink[] | undefined): SkillRowModel[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linked = [...(links ?? [])].sort((a, b) => a.order - b.order).filter((l) => byId.has(l.skill_id));
  const linkedIds = new Set(linked.map((l) => l.skill_id));
  const head: SkillRowModel[] = linked.map((l) => ({ skill: byId.get(l.skill_id)!, linked: true, enabled: l.enabled }));
  const tail: SkillRowModel[] = skills
    .filter((sk) => !linkedIds.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((sk) => ({ skill: sk, linked: false, enabled: false }));
  return [...head, ...tail];
}

/** Items for the linked rows, in order. */
export function toItems(rows: SkillRowModel[]): SkillItem[] {
  return rows.filter((r) => r.linked).map((r) => ({ skill_id: r.skill.id, enabled: r.enabled }));
}

/** Checkbox: attach (appended, enabled) an unlinked skill, or flip enabled in place (keeps its position). */
export function toggleSkill(rows: SkillRowModel[], skillId: string): SkillItem[] {
  const items = toItems(rows);
  const existing = items.find((i) => i.skill_id === skillId);
  if (existing) return items.map((i) => (i.skill_id === skillId ? { ...i, enabled: !i.enabled } : i));
  return [...items, { skill_id: skillId, enabled: true }];
}

/** ↑/↓ buttons: move a linked skill by `delta` positions among the linked ones. */
export function moveSkill(rows: SkillRowModel[], skillId: string, delta: -1 | 1): SkillItem[] {
  const items = toItems(rows);
  const from = items.findIndex((i) => i.skill_id === skillId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Drag and drop: put `skillId` where `targetId` currently is. */
export function moveSkillTo(rows: SkillRowModel[], skillId: string, targetId: string): SkillItem[] {
  const items = toItems(rows);
  const from = items.findIndex((i) => i.skill_id === skillId);
  const to = items.findIndex((i) => i.skill_id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export function enabledCount(rows: SkillRowModel[]): number {
  return rows.filter((r) => r.linked && r.enabled).length;
}

export function filterRows(rows: SkillRowModel[], search: string): SkillRowModel[] {
  const q = search.trim().toLowerCase();
  return q ? rows.filter((r) => r.skill.name.toLowerCase().includes(q)) : rows;
}
