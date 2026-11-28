import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
import type { SkillSource, SkillType } from '@devdigest/shared';
import { INITIAL_SKILL_VERSION, STATS_WINDOW_DAYS } from './constants.js';

export type { SkillRow, SkillVersionRow };

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
}

export interface SkillPatch {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** A skill as injected into a run: enabled globally AND for the agent, in link order. */
export interface ResolvedSkill {
  id: string;
  name: string;
  type: SkillType;
  version: number;
  description: string;
  body: string;
}

export interface SkillUsage {
  agent_count: number;
  pull_rate: number | null;
  accept_rate: number | null;
}

export interface RawSkillStats extends SkillUsage {
  findings_30d: number;
  agents: { id: string; name: string }[];
  by_category: { category: string; count: number }[];
}

function windowStart(): Date {
  return new Date(Date.now() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function rate(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

/**
 * Skills data-access. Owns `skills`, `skill_versions` and `run_skills`; the
 * agent side of `agent_skills` stays in the agents repository. Workspace-scoped.
 */
export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  async getByName(workspaceId: string, name: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, name)));
    return row;
  }

  /** Insert a skill AND its v1 snapshot in one transaction. */
  async insert(values: InsertSkill): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({ ...values, version: INITIAL_SKILL_VERSION })
        .returning();
      await tx.insert(t.skillVersions).values({
        skillId: row!.id,
        version: INITIAL_SKILL_VERSION,
        body: row!.body,
        description: row!.description,
        message: null,
      });
      return row!;
    });
  }

  /**
   * Patch a skill. A body or description change (both go into the prompt) bumps
   * the version and writes an immutable snapshot; name/type/enabled do not.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: SkillPatch,
    message?: string,
  ): Promise<SkillRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [cur] = await tx
        .select()
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .for('update');
      if (!cur) return undefined;
      const contentChanged =
        (patch.body !== undefined && patch.body !== cur.body) ||
        (patch.description !== undefined && patch.description !== cur.description);
      const version = contentChanged ? cur.version + 1 : cur.version;
      const [row] = await tx
        .update(t.skills)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          version,
          updatedAt: new Date(),
        })
        .where(eq(t.skills.id, id))
        .returning();
      if (contentChanged) {
        await tx.insert(t.skillVersions).values({
          skillId: id,
          version,
          body: row!.body,
          description: row!.description,
          message: message ?? null,
        });
      }
      return row;
    });
  }

  /** Delete a skill (links cascade). Returns the number of agents it was linked to, or undefined. */
  async delete(workspaceId: string, id: string): Promise<{ unlinked: number } | undefined> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: t.skills.id })
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
      if (!existing) return undefined;
      const [links] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(t.agentSkills)
        .where(eq(t.agentSkills.skillId, id));
      await tx.delete(t.skills).where(eq(t.skills.id, id));
      return { unlinked: links?.n ?? 0 };
    });
  }

  // ---- versions ------------------------------------------------------------

  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }

  /** Restore = append a NEW version copying an old one; history is never rewritten. */
  async restore(
    workspaceId: string,
    id: string,
    fromVersion: number,
  ): Promise<SkillRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [cur] = await tx
        .select()
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .for('update');
      if (!cur) return undefined;
      const [old] = await tx
        .select()
        .from(t.skillVersions)
        .where(and(eq(t.skillVersions.skillId, id), eq(t.skillVersions.version, fromVersion)));
      if (!old) return undefined;
      const version = cur.version + 1;
      const [row] = await tx
        .update(t.skills)
        .set({ body: old.body, description: old.description, version, updatedAt: new Date() })
        .where(eq(t.skills.id, id))
        .returning();
      await tx.insert(t.skillVersions).values({
        skillId: id,
        version,
        body: old.body,
        description: old.description,
        message: `Restored from v${fromVersion}`,
      });
      return row;
    });
  }

  // ---- injection -----------------------------------------------------------

  /** Skills to inject for an agent: enabled on the link AND globally, in link order. */
  async resolvedForAgent(agentId: string): Promise<ResolvedSkill[]> {
    const rows = await this.db
      .select({ skill: t.skills })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .orderBy(asc(t.agentSkills.order));
    return rows.map(({ skill }) => ({
      id: skill.id,
      name: skill.name,
      type: skill.type as SkillType,
      version: skill.version,
      description: skill.description,
      body: skill.body,
    }));
  }

  /** Record which skill versions went into a run's prompt (position = prompt order). */
  async recordRunSkills(runId: string, skills: ResolvedSkill[]): Promise<void> {
    if (skills.length === 0) return;
    await this.db.insert(t.runSkills).values(
      skills.map((s, position) => ({
        runId,
        skillId: s.id,
        skillName: s.name,
        skillVersion: s.version,
        position,
      })),
    );
  }

  // ---- usage / stats (correlational, 30-day window) ------------------------

  /** Distinct PRs reviewed in the window (denominator of pull_rate). */
  private async totalReviewedPrs(workspaceId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(distinct ${t.agentRuns.prId})::int` })
      .from(t.agentRuns)
      .where(
        and(
          eq(t.agentRuns.workspaceId, workspaceId),
          gte(t.agentRuns.ranAt, since),
          isNotNull(t.agentRuns.prId),
        ),
      );
    return row?.n ?? 0;
  }

  /** Usage aggregates for list cards, keyed by skill id. */
  async usageFor(workspaceId: string, skillIds: string[]): Promise<Map<string, SkillUsage>> {
    const out = new Map<string, SkillUsage>();
    if (skillIds.length === 0) return out;
    const since = windowStart();

    const agentCounts = await this.db
      .select({ skillId: t.agentSkills.skillId, n: sql<number>`count(*)::int` })
      .from(t.agentSkills)
      .where(and(inArray(t.agentSkills.skillId, skillIds), eq(t.agentSkills.enabled, true)))
      .groupBy(t.agentSkills.skillId);

    const totalPrs = await this.totalReviewedPrs(workspaceId, since);
    const prCounts = await this.db
      .select({
        skillId: t.runSkills.skillId,
        n: sql<number>`count(distinct ${t.agentRuns.prId})::int`,
      })
      .from(t.runSkills)
      .innerJoin(t.agentRuns, eq(t.runSkills.runId, t.agentRuns.id))
      .where(
        and(
          inArray(t.runSkills.skillId, skillIds),
          eq(t.agentRuns.workspaceId, workspaceId),
          gte(t.agentRuns.ranAt, since),
          isNotNull(t.agentRuns.prId),
        ),
      )
      .groupBy(t.runSkills.skillId);

    const decisions = await this.db
      .select({
        skillId: t.runSkills.skillId,
        accepted: sql<number>`count(${t.findings.acceptedAt})::int`,
        dismissed: sql<number>`count(${t.findings.dismissedAt})::int`,
      })
      .from(t.runSkills)
      .innerJoin(t.agentRuns, eq(t.runSkills.runId, t.agentRuns.id))
      .innerJoin(t.reviews, eq(t.reviews.runId, t.runSkills.runId))
      .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
      .where(
        and(
          inArray(t.runSkills.skillId, skillIds),
          eq(t.agentRuns.workspaceId, workspaceId),
          gte(t.agentRuns.ranAt, since),
        ),
      )
      .groupBy(t.runSkills.skillId);

    const agents = new Map(agentCounts.map((r) => [r.skillId, r.n]));
    const prs = new Map(prCounts.map((r) => [r.skillId ?? '', r.n]));
    const dec = new Map(decisions.map((r) => [r.skillId ?? '', r]));
    for (const id of skillIds) {
      const d = dec.get(id);
      out.set(id, {
        agent_count: agents.get(id) ?? 0,
        pull_rate: rate(prs.get(id) ?? 0, totalPrs),
        accept_rate: d ? rate(d.accepted, d.accepted + d.dismissed) : null,
      });
    }
    return out;
  }

  /** Full stats for the Stats tab. */
  async statsFor(workspaceId: string, skillId: string): Promise<RawSkillStats> {
    const since = windowStart();
    const usage = (await this.usageFor(workspaceId, [skillId])).get(skillId) ?? {
      agent_count: 0,
      pull_rate: null,
      accept_rate: null,
    };

    const agents = await this.db
      .select({ id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          eq(t.agentSkills.skillId, skillId),
          eq(t.agentSkills.enabled, true),
          eq(t.agents.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(t.agents.name));

    const byCategory = await this.db
      .select({ category: t.findings.category, count: sql<number>`count(*)::int` })
      .from(t.runSkills)
      .innerJoin(t.agentRuns, eq(t.runSkills.runId, t.agentRuns.id))
      .innerJoin(t.reviews, eq(t.reviews.runId, t.runSkills.runId))
      .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
      .where(
        and(
          eq(t.runSkills.skillId, skillId),
          eq(t.agentRuns.workspaceId, workspaceId),
          gte(t.agentRuns.ranAt, since),
        ),
      )
      .groupBy(t.findings.category)
      .orderBy(desc(sql`count(*)`));

    return {
      ...usage,
      findings_30d: byCategory.reduce((n, r) => n + r.count, 0),
      agents,
      by_category: byCategory,
    };
  }
}
