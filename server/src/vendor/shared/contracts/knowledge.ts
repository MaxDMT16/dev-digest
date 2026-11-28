import { z } from 'zod';

/**
 * Conformance, Onboarding, Eval, Memory, Conventions, Skills,
 * Agents and their DTOs.
 */

// ---- Conformance ----
export const ConformanceStatus = z.enum(['implemented', 'missing', 'out_of_scope']);
export type ConformanceStatus = z.infer<typeof ConformanceStatus>;

export const ConformanceItem = z.object({
  requirement: z.string(),
  status: ConformanceStatus,
  evidence_file: z.string().nullish(),
  notes: z.string().nullish(),
});
export type ConformanceItem = z.infer<typeof ConformanceItem>;

export const Conformance = z.object({
  spec_id: z.string(),
  spec_title: z.string(),
  items: z.array(ConformanceItem),
  completeness_pct: z.number().min(0).max(100),
});
export type Conformance = z.infer<typeof Conformance>;

// ---- Onboarding ----
export const OnboardingLink = z.object({
  label: z.string(),
  path: z.string(),
});
export type OnboardingLink = z.infer<typeof OnboardingLink>;

export const OnboardingSection = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(), // markdown
  diagram: z.string().nullish(), // mermaid
  links: z.array(OnboardingLink),
});
export type OnboardingSection = z.infer<typeof OnboardingSection>;

export const Onboarding = z.object({
  sections: z.array(OnboardingSection),
});
export type Onboarding = z.infer<typeof Onboarding>;

// ---- Eval ----
export const EvalPerTrace = z.object({
  name: z.string(),
  pass: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
});
export type EvalPerTrace = z.infer<typeof EvalPerTrace>;

export const EvalRun = z.object({
  recall: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  citation_accuracy: z.number().min(0).max(1),
  traces_passed: z.number().int(),
  traces_total: z.number().int(),
  duration_ms: z.number().int(),
  cost_usd: z.number().nullable(),
  per_trace: z.array(EvalPerTrace),
});
export type EvalRun = z.infer<typeof EvalRun>;

export const EvalOwnerKind = z.enum(['skill', 'agent']);
export type EvalOwnerKind = z.infer<typeof EvalOwnerKind>;

export const EvalCase = z.object({
  id: z.string(),
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  name: z.string(),
  input_diff: z.string(),
  input_files: z.unknown(),
  input_meta: z.unknown(),
  expected_output: z.unknown(),
  notes: z.string().nullish(),
});
export type EvalCase = z.infer<typeof EvalCase>;

// ---- Memory ----
export const MemoryScope = z.enum(['repo', 'global', 'team']);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryKind = z.enum([
  'decision',
  'convention',
  'preference',
  'fact',
  'learning',
]);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const MemorySource = z.object({
  pr: z.number().int().nullish(),
  context: z.string(),
});
export type MemorySource = z.infer<typeof MemorySource>;

export const MemoryItem = z.object({
  content: z.string(),
  scope: MemoryScope,
  kind: MemoryKind,
  confidence: z.number().min(0).max(1),
  sources: z.array(MemorySource),
});
export type MemoryItem = z.infer<typeof MemoryItem>;

// ---- Skills ----
export const SkillType = z.enum(['rubric', 'convention', 'security', 'custom']);
export type SkillType = z.infer<typeof SkillType>;

export const SkillSource = z.enum([
  'manual',
  'imported_url',
  'imported_file',
  'extracted',
  'community',
]);
export type SkillSource = z.infer<typeof SkillSource>;

/** kebab-case, 2-64 chars. */
export const SkillName = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'kebab-case, 2-64 chars');

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  source: SkillSource,
  body: z.string(),
  enabled: z.boolean(),
  version: z.number().int(),
  evidence_files: z.array(z.string()).nullish(),
});
export type Skill = z.infer<typeof Skill>;

/** Skill + 30d usage aggregates for list cards. Rates are null until there is data. */
export const SkillListItem = Skill.extend({
  usage: z.object({
    agent_count: z.number().int(),
    pull_rate: z.number().nullable(),
    accept_rate: z.number().nullable(),
  }),
});
export type SkillListItem = z.infer<typeof SkillListItem>;

export const CreateSkillBody = z.object({
  name: SkillName,
  description: z.string().max(1000),
  type: SkillType,
  body: z.string().min(1).max(100_000),
  enabled: z.boolean().optional(),
});
export type CreateSkillBody = z.infer<typeof CreateSkillBody>;

export const UpdateSkillBody = CreateSkillBody.partial().extend({
  version_message: z.string().max(200).optional(),
});
export type UpdateSkillBody = z.infer<typeof UpdateSkillBody>;

export const SkillVersion = z.object({
  version: z.number().int(),
  body: z.string(),
  description: z.string(),
  message: z.string().nullable(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/** Correlational: describes runs where the skill was present, not its effect. */
export const SkillStats = z.object({
  agent_count: z.number().int(),
  pull_rate: z.number().nullable(),
  accept_rate: z.number().nullable(),
  findings_30d: z.number().int(),
  agents: z.array(z.object({ id: z.string(), name: z.string() })),
  by_category: z.array(z.object({ category: z.string(), count: z.number().int() })),
});
export type SkillStats = z.infer<typeof SkillStats>;

// ---- Skill import (preview → confirm; nothing is stored by preview) ----
export const SkillImportRequest = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().min(1),
});
export type SkillImportRequest = z.infer<typeof SkillImportRequest>;

export const SkillDraft = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
});
export type SkillDraft = z.infer<typeof SkillDraft>;

export const SkillImportWarning = z.object({ code: z.string(), message: z.string() });
export type SkillImportWarning = z.infer<typeof SkillImportWarning>;

export const SkillImportPreview = z.object({
  draft: SkillDraft,
  files: z.object({
    used: z.string(),
    ignored: z.array(z.object({ path: z.string(), reason: z.string() })),
  }),
  warnings: z.array(SkillImportWarning),
});
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;

export const SkillImportConfirm = z.object({
  draft: z.object({
    name: SkillName,
    description: z.string().max(1000),
    type: SkillType,
    body: z.string().min(1).max(100_000),
  }),
  source: z.enum(['imported_file', 'community']),
  origin: z.string().max(300).optional(),
});
export type SkillImportConfirm = z.infer<typeof SkillImportConfirm>;

export const CommunitySkill = z.object({
  slug: z.string(),
  name: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  lang: z.string(),
  desc: z.string(),
  tags: z.array(z.string()),
});
export type CommunitySkill = z.infer<typeof CommunitySkill>;

export const CommunitySkillDetail = CommunitySkill.extend({
  type: SkillType,
  body: z.string(),
});
export type CommunitySkillDetail = z.infer<typeof CommunitySkillDetail>;

// ---- Conventions ----
export const ConventionCandidate = z.object({
  id: z.string(),
  rule: z.string(),
  evidence_path: z.string(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  accepted: z.boolean(),
});
export type ConventionCandidate = z.infer<typeof ConventionCandidate>;

// ---- Agents ----
// 'openrouter' routes through the OpenAI-compatible API (OpenAIProvider with a
// custom baseURL) — used by the CI runner for cheap models (DeepSeek/GLM/MiniMax).
export const Provider = z.enum(['openai', 'anthropic', 'openrouter']);
export type Provider = z.infer<typeof Provider>;

// Review execution strategy (matches @devdigest/reviewer-core's ReviewStrategy):
//  - single-pass: send the WHOLE diff in ONE model call (default)
//  - map-reduce:  one model call PER changed file (for very large diffs)
//  - auto:        single-pass, switching to map-reduce when the diff is large
export const ReviewStrategy = z.enum(['single-pass', 'map-reduce', 'auto']);
export type ReviewStrategy = z.infer<typeof ReviewStrategy>;

// CI gate policy — when a review should BLOCK (REQUEST_CHANGES + fail the check)
// vs just comment. Deterministic from finding severities, NOT the model's verdict:
//  - never:    never block, always comment (advisory only)
//  - critical: block iff >=1 CRITICAL finding (default)
//  - warning:  block iff >=1 WARNING or CRITICAL finding
//  - any:      block iff >=1 finding of any severity
export const CiFailOn = z.enum(['never', 'critical', 'warning', 'any']);
export type CiFailOn = z.infer<typeof CiFailOn>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  enabled: z.boolean(),
  version: z.number().int(),
  strategy: ReviewStrategy.default('single-pass'),
  ci_fail_on: CiFailOn.default('critical'),
  // Inject repo-intel context (repo skeleton + callers + rank note) into this
  // agent's review prompt. Default on; gated again by the global flag.
  repo_intel: z.boolean().default(true),
  // Count of enabled skill links (list cards). Optional: only list endpoints fill it.
  skill_count: z.number().int().optional(),
});
export type Agent = z.infer<typeof Agent>;

export const AgentSkillLink = z.object({
  agent_id: z.string(),
  skill_id: z.string(),
  order: z.number().int(),
  enabled: z.boolean().default(true),
});
export type AgentSkillLink = z.infer<typeof AgentSkillLink>;

/** Full ordered set of an agent's skill links; array index = order. */
export const SetAgentSkillsBody = z.object({
  items: z.array(z.object({ skill_id: z.string().uuid(), enabled: z.boolean() })).max(200),
});
export type SetAgentSkillsBody = z.infer<typeof SetAgentSkillsBody>;

// The immutable config snapshot captured in `agent_versions` whenever an agent's
// config changes (everything but `enabled`). Mirrors the shape written by the
// agents repository — provider/model/prompt/output_schema/strategy/gate/repo_intel
// plus the ordered skill ids linked at snapshot time. Used for reproducibility
// (eval replays a past version) and for surfacing an agent's edit history.
export const AgentVersionConfig = z.object({
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  strategy: ReviewStrategy,
  ci_fail_on: CiFailOn,
  repo_intel: z.boolean(),
  skills: z.array(z.string()),
});
export type AgentVersionConfig = z.infer<typeof AgentVersionConfig>;

export const AgentVersion = z.object({
  agent_id: z.string(),
  version: z.number().int(),
  config: AgentVersionConfig,
  created_at: z.string(),
});
export type AgentVersion = z.infer<typeof AgentVersion>;
