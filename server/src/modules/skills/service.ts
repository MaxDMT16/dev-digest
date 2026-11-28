import type {
  CommunitySkill,
  CommunitySkillDetail,
  CreateSkillBody,
  Skill,
  SkillImportConfirm,
  SkillImportPreview,
  SkillImportRequest,
  SkillListItem,
  SkillStats,
  SkillVersion,
  UpdateSkillBody,
} from '@devdigest/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import type { SkillsRepository } from './repository.js';
import { getCommunityDetail, searchCommunity } from './community-catalog.js';
import { ImportError, parseSkillImport } from './import-parser.js';
import { isUniqueViolation, stripInvisibleChars } from './helpers.js';

const DUPLICATE = 'A skill with this name already exists';

export class SkillsService {
  constructor(private repo: SkillsRepository) {}

  async list(workspaceId: string): Promise<SkillListItem[]> {
    const rows = await this.repo.list(workspaceId);
    const usage = await this.repo.usageFor(
      workspaceId,
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      ...r,
      usage: usage.get(r.id) ?? { agent_count: 0, pull_rate: null, accept_rate: null },
    }));
  }

  async get(workspaceId: string, id: string): Promise<Skill> {
    return this.require(workspaceId, id);
  }

  async create(workspaceId: string, body: CreateSkillBody): Promise<Skill> {
    return this.insert(workspaceId, {
      name: body.name,
      description: body.description,
      type: body.type,
      body: body.body,
      source: 'manual',
      enabled: body.enabled ?? true,
    });
  }

  async update(workspaceId: string, id: string, patch: UpdateSkillBody): Promise<Skill> {
    const { version_message, ...fields } = patch;
    try {
      const row = await this.repo.update(
        workspaceId,
        id,
        {
          ...fields,
          ...(fields.body !== undefined ? { body: stripInvisibleChars(fields.body) } : {}),
          ...(fields.description !== undefined
            ? { description: stripInvisibleChars(fields.description) }
            : {}),
        },
        version_message,
      );
      if (!row) throw new NotFoundError('Skill not found');
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError(DUPLICATE);
      throw e;
    }
  }

  async delete(workspaceId: string, id: string): Promise<{ ok: true; unlinked_agents: number }> {
    const res = await this.repo.delete(workspaceId, id);
    if (!res) throw new NotFoundError('Skill not found');
    return { ok: true, unlinked_agents: res.unlinked };
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[]> {
    await this.require(workspaceId, id);
    return this.repo.listVersions(id);
  }

  async getVersion(workspaceId: string, id: string, version: number): Promise<SkillVersion> {
    await this.require(workspaceId, id);
    const row = await this.repo.getVersion(id, version);
    if (!row) throw new NotFoundError('Skill version not found');
    return row;
  }

  async restore(workspaceId: string, id: string, version: number): Promise<Skill> {
    const row = await this.repo.restore(workspaceId, id, version);
    if (!row) throw new NotFoundError('Skill or version not found');
    return row;
  }

  async stats(workspaceId: string, id: string): Promise<SkillStats> {
    await this.require(workspaceId, id);
    return this.repo.statsFor(workspaceId, id);
  }

  // ---- import ---------------------------------------------------------------

  /** Parse only; persists NOTHING. */
  importPreview(req: SkillImportRequest): SkillImportPreview {
    const bytes = Buffer.from(req.content_base64, 'base64');
    try {
      return parseSkillImport(req.filename, bytes);
    } catch (e) {
      if (e instanceof ImportError) throw new ValidationError(e.message, { code: e.code });
      throw e;
    }
  }

  /** Persist a confirmed draft. Always saved DISABLED: the user must read and enable it. */
  async importConfirm(workspaceId: string, body: SkillImportConfirm): Promise<Skill> {
    return this.insert(workspaceId, {
      name: body.draft.name,
      description: body.draft.description,
      type: body.draft.type,
      body: body.draft.body,
      source: body.source,
      enabled: false,
    });
  }

  communitySearch(q?: string, lang?: string, tag?: string): CommunitySkill[] {
    return searchCommunity(q, lang, tag);
  }

  communityDetail(slug: string): CommunitySkillDetail {
    const detail = getCommunityDetail(slug);
    if (!detail) throw new NotFoundError('Community skill not found');
    return detail;
  }

  // ---- internals ------------------------------------------------------------

  private async require(workspaceId: string, id: string): Promise<Skill> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) throw new NotFoundError('Skill not found');
    return row;
  }

  private async insert(
    workspaceId: string,
    v: Parameters<SkillsRepository['insert']>[0] extends infer P
      ? Omit<P & object, 'workspaceId'>
      : never,
  ): Promise<Skill> {
    try {
      const row = await this.repo.insert({
        workspaceId,
        ...v,
        description: stripInvisibleChars(v.description),
        body: stripInvisibleChars(v.body),
      });
      return row;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError(DUPLICATE);
      throw e;
    }
  }
}
