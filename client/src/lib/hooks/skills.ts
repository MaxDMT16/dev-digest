/* hooks/skills.ts — React Query hooks for the Skills section and the agent
   Skills tab. Query keys: ["skills"], ["skill", id], ["skill-versions", id],
   ["skill-stats", id], ["agent-skills", agentId], ["community-skills", q, lang, tag].
   Mutations invalidate every list whose numbers they change (agent cards show
   `skill_count`; skill cards show usage). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentSkillLink,
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
} from "@devdigest/shared";

export function useSkills() {
  return useQuery({ queryKey: ["skills"], queryFn: () => api.get<SkillListItem[]>("/skills") });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillBody) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: UpdateSkillBody;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
      qc.invalidateQueries({ queryKey: ["skill-stats", data.id] });
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean; unlinked_agents: number }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["skill", id] });
      qc.invalidateQueries({ queryKey: ["skills"] });
      // Agent cards show skill_count; per-agent link lists lost an entry.
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
    },
  });
}

export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-stats", id],
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

/** Parse an uploaded file on the server. Persists nothing. */
export function useImportPreview() {
  return useMutation({
    mutationFn: (req: SkillImportRequest) =>
      api.post<SkillImportPreview>("/skills/import/preview", req),
  });
}

/** Save a confirmed draft (always stored disabled by the server). */
export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SkillImportConfirm) => api.post<Skill>("/skills/import", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useCommunitySkills(q: string, lang: string, tag: string) {
  return useQuery({
    queryKey: ["community-skills", q, lang, tag],
    queryFn: () => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (lang) sp.set("lang", lang);
      if (tag) sp.set("tag", tag);
      const qs = sp.toString();
      return api.get<CommunitySkill[]>(`/skills/community${qs ? `?${qs}` : ""}`);
    },
    staleTime: 5 * 60_000,
  });
}

/** Fetched on demand when the user imports a community entry (not a query). */
export function useFetchCommunitySkill() {
  return useMutation({
    mutationFn: (slug: string) =>
      api.get<CommunitySkillDetail>(`/skills/community/${encodeURIComponent(slug)}`),
  });
}

// ---- agent ⇄ skill links --------------------------------------------------

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

export interface AgentSkillItem {
  skill_id: string;
  enabled: boolean;
}

/** Replace the agent's full ordered skill set. Optimistic with rollback. */
export function useSetAgentSkills(agentId: string) {
  const qc = useQueryClient();
  const key = ["agent-skills", agentId];
  return useMutation({
    // Same scope id ⇒ TanStack runs these one after another, so rapid
    // toggles/reorders cannot arrive out of order at the server.
    scope: { id: `agent-skills:${agentId}` },
    mutationFn: (items: AgentSkillItem[]) =>
      api.put<AgentSkillLink[]>(`/agents/${agentId}/skills`, { items }),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AgentSkillLink[]>(key);
      qc.setQueryData<AgentSkillLink[]>(
        key,
        items.map((it, order) => ({ agent_id: agentId, skill_id: it.skill_id, order, enabled: it.enabled })),
      );
      return { prev };
    },
    onError: (_e, _items, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
