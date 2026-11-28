/** Zero-width, bidi-control and similar invisible characters (they hide text from reviewers). */
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

export function hasInvisibleChars(text: string): boolean {
  INVISIBLE_RE.lastIndex = 0;
  return INVISIBLE_RE.test(text);
}

/** Applied on EVERY save path (manual, import, community, restore). */
export function stripInvisibleChars(text: string): string {
  return text.replace(INVISIBLE_RE, '');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** kebab-case slug that satisfies `SkillName`, or the fallback. */
export function slugify(input: string, fallback = 'imported-skill'): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return /^[a-z0-9][a-z0-9-]{1,63}$/.test(slug) ? slug : fallback;
}

/** `</skill` (any case) must not be able to close our block early. */
function escapeClose(text: string): string {
  return text.replace(/<\/skill/gi, '<\\/skill');
}

function escapeAttr(text: string): string {
  return escapeClose(text).replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ');
}

export interface SkillBlockInput {
  name: string;
  type: string;
  version: number;
  description: string;
  body: string;
}

/** One prompt block per skill; blocks are joined in `agent_skills.order`. */
export function formatSkillBlock(s: SkillBlockInput): string {
  const head = `<skill name="${escapeAttr(s.name)}" type="${escapeAttr(s.type)}" version="${s.version}">`;
  const desc = s.description.trim() ? `Description: ${escapeClose(s.description.trim())}\n\n` : '';
  return `${head}\n${desc}${escapeClose(s.body)}\n</skill>`;
}

/** Postgres unique_violation, surfaced directly or wrapped by drizzle (`cause`). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}
