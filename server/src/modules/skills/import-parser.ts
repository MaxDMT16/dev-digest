import { unzipSync } from 'fflate';
import { parse as parseYaml } from 'yaml';
import { SkillType } from '@devdigest/shared';
import type { SkillImportPreview, SkillImportWarning } from '@devdigest/shared';
import {
  IMPORT_MAX_COMPRESSED_BYTES,
  IMPORT_MAX_CORE_BYTES,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_UNCOMPRESSED_BYTES,
  LONG_BODY_TOKENS,
} from './constants.js';
import { estimateTokens, hasInvisibleChars, slugify, stripInvisibleChars } from './helpers.js';

/**
 * Pure import parser: bytes in, preview out. No I/O, no network, nothing written
 * to disk. For archives ONLY the core markdown file is ever decompressed; every
 * other entry (scripts, binaries, other docs) is merely listed as not processed.
 */
export class ImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

const SCRIPT_EXT = /\.(sh|bash|zsh|py|rb|pl|js|mjs|cjs|ts|ps1|bat|cmd|exe|dll|so|dylib|jar|php)$/i;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function isZip(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

function isUnsafePath(path: string): boolean {
  return path.startsWith('/') || path.includes('\\') || path.split('/').includes('..');
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ImportError('invalid_encoding', 'The skill file is not valid UTF-8 text.');
  }
}

interface Entry {
  name: string;
  size: number;
  originalSize: number;
}

/** Choose the core file: SKILL.md at the root / single top-level folder, else the only .md. */
function pickCore(entries: Entry[]): Entry | undefined {
  const files = entries.filter((e) => !e.name.endsWith('/') && !isUnsafePath(e.name));
  const topLevels = new Set(files.map((e) => e.name.split('/')[0]));
  const skillMd = files.find((e) => {
    const parts = e.name.split('/');
    if (parts[parts.length - 1]!.toLowerCase() !== 'skill.md') return false;
    return parts.length === 1 || (parts.length === 2 && topLevels.size === 1);
  });
  if (skillMd) return skillMd;
  const mds = files.filter((e) => /\.(md|markdown)$/i.test(e.name));
  return mds.length === 1 ? mds[0] : undefined;
}

function readCoreFromZip(bytes: Uint8Array): {
  path: string;
  text: string;
  ignored: SkillImportPreview['files']['ignored'];
} {
  const entries: Entry[] = [];
  // Pass 1: headers only. The filter never selects anything, so nothing is inflated.
  unzipSync(bytes, {
    filter: (f) => {
      entries.push({ name: f.name, size: f.size, originalSize: f.originalSize });
      return false;
    },
  });
  if (entries.length > IMPORT_MAX_ENTRIES) {
    throw new ImportError('too_many_entries', `Archive has more than ${IMPORT_MAX_ENTRIES} entries.`);
  }
  const declared = entries.reduce((n, e) => n + e.originalSize, 0);
  if (declared > IMPORT_MAX_UNCOMPRESSED_BYTES) {
    throw new ImportError('archive_too_large', 'Archive expands to more than 5 MB.');
  }

  const core = pickCore(entries);
  if (!core) {
    throw new ImportError('no_core_file', 'No SKILL.md (or single .md file) found in the archive.');
  }
  if (core.originalSize > IMPORT_MAX_CORE_BYTES || core.size > IMPORT_MAX_CORE_BYTES) {
    throw new ImportError('core_too_large', 'The skill file is larger than 100 KB.');
  }

  // Pass 2: inflate the core entry and nothing else.
  const out = unzipSync(bytes, { filter: (f) => f.name === core.name });
  const data = out[core.name];
  if (!data || data.length > IMPORT_MAX_CORE_BYTES) {
    throw new ImportError('core_too_large', 'The skill file is larger than 100 KB.');
  }

  const ignored = entries
    .filter((e) => e.name !== core.name && !e.name.endsWith('/'))
    .map((e) => ({
      path: e.name,
      reason: isUnsafePath(e.name)
        ? 'unsafe_path'
        : SCRIPT_EXT.test(e.name)
          ? 'executable_not_processed'
          : 'not_processed',
    }));
  return { path: core.name, text: decodeUtf8(data), ignored };
}

interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
  bad: boolean;
}

function splitFrontmatter(text: string): Frontmatter {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text, bad: false };
  try {
    const parsed: unknown = parseYaml(m[1]!, { schema: 'core', maxAliasCount: 0 });
    const data =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return { data, body: text.slice(m[0].length), bad: false };
  } catch {
    return { data: {}, body: text.slice(m[0].length), bad: true };
  }
}

/** Linear scan (a lazy `<!--[\s\S]*?-->` regex is quadratic on a body of repeated `<!--`). */
function hasHtmlComment(text: string): boolean {
  const open = text.indexOf('<!--');
  return open >= 0 && text.indexOf('-->', open + 4) >= 0;
}

function collectWarnings(raw: string, body: string, fmBad: boolean): SkillImportWarning[] {
  const w: SkillImportWarning[] = [];
  if (fmBad) {
    w.push({ code: 'bad_frontmatter', message: 'Frontmatter could not be parsed and was ignored.' });
  }
  if (hasHtmlComment(body)) {
    w.push({
      code: 'html_comment',
      message: 'Contains HTML comments: hidden in rendered Markdown, but the model sees them.',
    });
  }
  if (hasInvisibleChars(raw)) {
    w.push({
      code: 'invisible_chars',
      message: 'Contained invisible or bidirectional characters; they were removed.',
    });
  }
  if (/[A-Za-z0-9+/=]{200,}/.test(body)) {
    w.push({ code: 'base64_blob', message: 'Contains a long base64-like blob.' });
  }
  if (/https?:\/\/\S+/i.test(body)) {
    w.push({ code: 'external_url', message: 'References external URLs.' });
  }
  if (estimateTokens(body) > LONG_BODY_TOKENS) {
    w.push({ code: 'long_body', message: `Body is longer than ~${LONG_BODY_TOKENS} tokens.` });
  }
  return w;
}

export function parseSkillImport(filename: string, bytes: Uint8Array): SkillImportPreview {
  if (bytes.length === 0) throw new ImportError('empty_file', 'The file is empty.');
  if (bytes.length > IMPORT_MAX_COMPRESSED_BYTES) {
    throw new ImportError('file_too_large', 'The file is larger than 1 MB.');
  }

  let usedPath = filename;
  let ignored: SkillImportPreview['files']['ignored'] = [];
  let text: string;
  if (isZip(bytes)) {
    try {
      const core = readCoreFromZip(bytes);
      usedPath = core.path;
      ignored = core.ignored;
      text = core.text;
    } catch (e) {
      if (e instanceof ImportError) throw e;
      throw new ImportError('invalid_archive', 'The archive could not be read.');
    }
  } else {
    if (!/\.(md|markdown)$/i.test(filename)) {
      throw new ImportError('unsupported_type', 'Only .md, .zip or .skill files are supported.');
    }
    if (bytes.length > IMPORT_MAX_CORE_BYTES) {
      throw new ImportError('core_too_large', 'The skill file is larger than 100 KB.');
    }
    text = decodeUtf8(bytes);
  }

  const { data, body: rawBody, bad } = splitFrontmatter(text);
  const body = stripInvisibleChars(rawBody).trim();
  if (!body) throw new ImportError('empty_body', 'The skill has no body.');

  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  const base = (usedPath.split('/').pop() ?? usedPath).replace(/\.[^.]+$/, '');
  const fmName = typeof data.name === 'string' ? data.name : undefined;
  const name = slugify(fmName ?? heading ?? (base.toLowerCase() === 'skill' ? '' : base));
  const description =
    typeof data.description === 'string' ? stripInvisibleChars(data.description).trim() : '';
  const typeParsed = SkillType.safeParse(data.type);

  return {
    draft: { name, description, type: typeParsed.success ? typeParsed.data : 'custom', body },
    files: { used: usedPath, ignored },
    warnings: collectWarnings(text, body, bad),
  };
}
