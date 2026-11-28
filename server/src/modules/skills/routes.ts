import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateSkillBody,
  SkillImportConfirm,
  SkillImportRequest,
  UpdateSkillBody,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { IMPORT_BODY_LIMIT } from './constants.js';
import { SkillsService } from './service.js';

/**
 * Skills module (see server/specs/2026-11-28-skills.md).
 *   GET    /skills                                 → list with 30d usage
 *   POST   /skills                                 → create (v1)
 *   GET    /skills/:id                             → one skill
 *   PUT    /skills/:id                             → update (body/description bump the version)
 *   DELETE /skills/:id                             → delete (links cascade)
 *   GET    /skills/:id/versions[/:version]         → history / one snapshot
 *   POST   /skills/:id/versions/:version/restore   → append a new version from an old one
 *   GET    /skills/:id/stats                       → 30-day, correlational
 *   POST   /skills/import/preview                  → parse only, persists nothing
 *   POST   /skills/import                          → save a confirmed draft (always disabled)
 *   GET    /skills/community[/:slug]               → curated static catalog
 */

const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});
const SlugParams = z.object({ slug: z.string().min(1).max(100) });
const CommunityQuery = z.object({
  q: z.string().max(100).optional(),
  lang: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container.skillsRepo);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  // Static segments first for readability; find-my-way prefers them over `:id` anyway.
  app.get('/skills/community', { schema: { querystring: CommunityQuery } }, async (req) => {
    await getContext(app.container, req);
    const { q, lang, tag } = req.query;
    return service.communitySearch(q, lang, tag);
  });

  app.get('/skills/community/:slug', { schema: { params: SlugParams } }, async (req) => {
    await getContext(app.container, req);
    return service.communityDetail(req.params.slug);
  });

  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_BODY_LIMIT, schema: { body: SkillImportRequest } },
    async (req) => {
      await getContext(app.container, req);
      return service.importPreview(req.body);
    },
  );

  app.post(
    '/skills/import',
    { bodyLimit: IMPORT_BODY_LIMIT, schema: { body: SkillImportConfirm } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.importConfirm(workspaceId, req.body);
      reply.status(201);
      return skill;
    },
  );

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.get(workspaceId, req.params.id);
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.update(workspaceId, req.params.id, req.body);
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.delete(workspaceId, req.params.id);
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.listVersions(workspaceId, req.params.id);
  });

  app.get('/skills/:id/versions/:version', { schema: { params: VersionParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.getVersion(workspaceId, req.params.id, req.params.version);
  });

  app.post(
    '/skills/:id/versions/:version/restore',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.restore(workspaceId, req.params.id, req.params.version);
    },
  );

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.stats(workspaceId, req.params.id);
  });
}
