export const INITIAL_SKILL_VERSION = 1;

/** Stats / usage window. */
export const STATS_WINDOW_DAYS = 30;

/** Import limits (see specs/2026-11-28-skills.md → Import). */
export const IMPORT_MAX_COMPRESSED_BYTES = 1_000_000;
export const IMPORT_MAX_ENTRIES = 200;
export const IMPORT_MAX_UNCOMPRESSED_BYTES = 5_000_000;
export const IMPORT_MAX_CORE_BYTES = 100_000;
/** Routes that receive base64 payloads (global bodyLimit is 1 MB). */
export const IMPORT_BODY_LIMIT = 2_000_000;
/** ≈ chars / 4. */
export const LONG_BODY_TOKENS = 8_000;
