/**
 * @fileoverview Core memory store module for Copilot Memory Store.
 *
 * Provides storage, search, and compression functionality for memories.
 * Uses a local JSON file as the backing store with file locking for
 * concurrent access safety.
 *
 * @module memoryStore
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * A single memory record stored in the JSON file.
 */
export type MemoryRecord = {
  /** Unique identifier (format: m_YYYYMMDDTHHMMSSZ_randomhex) */
  id: string;
  /** The memory content text */
  text: string;
  /** User-provided tags for categorization */
  tags: string[];
  /** Auto-extracted keywords for improved search */
  keywords: string[];
  /** ISO timestamp when the memory was created */
  createdAt: string;
  /** ISO timestamp when the memory was last modified */
  updatedAt: string;
  /** ISO timestamp if soft-deleted, null otherwise */
  deletedAt: string | null;
};

/**
 * Statistics about the memory store.
 */
export type StoreStats = {
  /** Total number of records (including deleted) */
  total: number;
  /** Number of active (non-deleted) records */
  active: number;
  /** Number of soft-deleted records */
  deleted: number;
  /** Tag frequency map */
  tags: Record<string, number>;
};

/**
 * A search result with relevance score.
 */
export type SearchHit = {
  id: string;
  text: string;
  tags: string[];
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  /** Relevance score (higher = more relevant) */
  score: number;
};

/**
 * Result of deterministic compression.
 */
export type CompressResult = {
  /** Compressed markdown output */
  markdown: string;
  /** Search hits that were included */
  included: SearchHit[];
  /** Requested character budget */
  budget: number;
  /** Actual characters used */
  used: number;
};

const DEFAULT_MEMORY_PATH = ".copilot-memory.json";
const DEFAULT_LOCK_NAME = ".copilot-memory.lock";

/** Returns current time as ISO string */
function nowIso(): string {
  return new Date().toISOString();
}

/** Generates a unique memory ID with timestamp and random suffix */
function makeId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "").replace(/-/g, "");
  const rand = crypto.randomBytes(3).toString("hex");
  return `m_${ts}_${rand}`;
}

/** Normalizes tags to lowercase, trimmed, unique values */
function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  const out = new Set<string>();
  for (const t of tags) {
    const cleaned = t.trim().toLowerCase();
    if (cleaned) out.add(cleaned);
  }
  return Array.from(out);
}

/**
 * Common English stop words filtered out during keyword extraction.
 * These words are too common to be useful for search relevance.
 */
const STOP_WORDS = new Set([
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "them",
  "a", "an", "the", "this", "that", "these", "those",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "can", "may", "might", "must", "shall",
  "and", "or", "but", "if", "then", "else", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "some", "any", "no",
  "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "also", "now", "here", "there", "about", "after", "before",
  "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
  "with", "without", "for", "of", "at", "by", "as", "into", "through",
  "like", "want", "use", "using", "used", "prefer", "always", "never",
]);

/**
 * Extracts meaningful keywords from text for search indexing.
 * Filters stop words and returns top 10 by frequency.
 *
 * @param text - The text to extract keywords from
 * @returns Array of up to 10 keywords, sorted by frequency
 */
function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/** Resolves memory file path from argument, env var, or default */
function resolveMemoryPath(p?: string): string {
  const raw = (p || process.env.MEMORY_PATH || DEFAULT_MEMORY_PATH).trim();
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

/** Resolves lock file path adjacent to memory file */
function resolveLockPath(memoryPath: string): string {
  const envLock = process.env.MEMORY_LOCK_PATH?.trim();
  if (envLock) return path.isAbsolute(envLock) ? envLock : path.resolve(process.cwd(), envLock);
  return path.join(path.dirname(memoryPath), DEFAULT_LOCK_NAME);
}

/** Promise-based sleep utility */
async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Acquires an exclusive file lock for concurrent access safety.
 * Uses atomic file creation (wx flag) as the locking mechanism.
 *
 * @param lockPath - Path to the lock file
 * @param timeoutMs - Maximum time to wait for lock (default 2500ms)
 * @throws Error if lock cannot be acquired within timeout
 */
async function acquireLock(lockPath: string, timeoutMs = 2500): Promise<void> {
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, `${process.pid} ${nowIso()}\n`, { encoding: "utf-8" });
      fs.closeSync(fd);
      return;
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      if (Date.now() - start > timeoutMs) throw new Error(`Timed out acquiring lock: ${lockPath}`);
      await sleep(50 + Math.floor(Math.random() * 50));
    }
  }
}

/** Releases file lock by deleting the lock file */
function releaseLock(lockPath: string): void {
  try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
}

/** Reads and parses the JSON memory file, returns empty array if not exists */
function readJsonArray(filePath: string): MemoryRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`Memory file must be a JSON array: ${filePath}`);
  return data as MemoryRecord[];
}

/** Writes data atomically using tmp file + rename pattern */
function atomicWrite(filePath: string, data: any): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}.${crypto.randomBytes(3).toString("hex")}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { encoding: "utf-8" });
  fs.renameSync(tmp, filePath);
}

/**
 * Loads the memory store from disk.
 *
 * @param memoryPath - Optional path override (uses MEMORY_PATH env or default)
 * @returns Object containing resolved path and all records
 */
export function loadStore(memoryPath?: string): { memoryPath: string; records: MemoryRecord[] } {
  const mp = resolveMemoryPath(memoryPath);
  const records = readJsonArray(mp);
  return { memoryPath: mp, records };
}

/**
 * Adds a new memory to the store.
 * Automatically extracts keywords from text for improved search.
 *
 * @param opts.memoryPath - Optional path override
 * @param opts.text - The memory content (required)
 * @param opts.tags - Optional tags for categorization
 * @returns The created memory record
 * @throws Error if text is empty
 */
export async function addMemory(opts: { memoryPath?: string; text: string; tags?: string[] }): Promise<MemoryRecord> {
  const tags = normalizeTags(opts.tags);
  const mp = resolveMemoryPath(opts.memoryPath);
  const lock = resolveLockPath(mp);

  await acquireLock(lock);
  try {
    const records = readJsonArray(mp);
    const t = opts.text.trim();
    if (!t) throw new Error("Cannot add an empty memory.");
    const keywords = extractKeywords(t);
    const rec: MemoryRecord = {
      id: makeId(),
      text: t,
      tags,
      keywords,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    };
    records.push(rec);
    atomicWrite(mp, records);
    return rec;
  } finally {
    releaseLock(lock);
  }
}

/**
 * Soft-deletes a memory by setting its deletedAt timestamp.
 * The record remains in the store but is excluded from searches.
 *
 * @param opts.memoryPath - Optional path override
 * @param opts.id - The memory ID to delete
 * @returns Object indicating if found and the updated record
 */
export async function softDeleteById(opts: { memoryPath?: string; id: string }): Promise<{ found: boolean; record?: MemoryRecord }> {
  const mp = resolveMemoryPath(opts.memoryPath);
  const lock = resolveLockPath(mp);

  await acquireLock(lock);
  try {
    const records = readJsonArray(mp);
    const idx = records.findIndex((r) => r.id === opts.id);
    if (idx < 0) return { found: false };
    const r = records[idx];
    if (!r.deletedAt) {
      r.deletedAt = nowIso();
      r.updatedAt = nowIso();
      records[idx] = r;
      atomicWrite(mp, records);
    }
    return { found: true, record: r };
  } finally {
    releaseLock(lock);
  }
}

/**
 * Hard-deletes memories matching criteria (permanently removes from file).
 * Exactly one of id, match, or tag must be provided.
 *
 * @param opts.memoryPath - Optional path override
 * @param opts.id - Delete by exact ID
 * @param opts.match - Delete by substring match in text
 * @param opts.tag - Delete by tag
 * @param opts.dryRun - If true, returns what would be deleted without deleting
 * @returns Object with count and IDs of purged records
 * @throws Error if no criteria provided
 */
export async function purge(opts: { memoryPath?: string; id?: string; match?: string; tag?: string; dryRun?: boolean }): Promise<{ purged: number; ids: string[] }> {
  const mp = resolveMemoryPath(opts.memoryPath);
  const lock = resolveLockPath(mp);

  const id = opts.id?.trim();
  const match = opts.match?.trim();
  const tag = opts.tag?.trim().toLowerCase();
  if (!id && !match && !tag) throw new Error("purge requires one of: --id, --match, --tag");

  await acquireLock(lock);
  try {
    const records = readJsonArray(mp);

    let predicate: (r: MemoryRecord) => boolean;
    if (id) predicate = (r) => r.id === id;
    else if (tag) predicate = (r) => r.tags.map((t) => t.toLowerCase()).includes(tag);
    else {
      const needle = match!.toLowerCase();
      predicate = (r) => (r.text || "").toLowerCase().includes(needle);
    }

    const ids = records.filter(predicate).map((r) => r.id);
    if (opts.dryRun) return { purged: ids.length, ids };

    const kept = records.filter((r) => !predicate(r));
    atomicWrite(mp, kept);
    return { purged: ids.length, ids };
  } finally {
    releaseLock(lock);
  }
}

/**
 * Computes statistics about the memory store.
 *
 * @param records - Array of memory records
 * @returns Stats including counts and tag frequencies
 */
export function computeStats(records: MemoryRecord[]): StoreStats {
  const tags: Record<string, number> = {};
  let deleted = 0;
  for (const r of records) {
    if (r.deletedAt) deleted += 1;
    for (const t of r.tags || []) tags[t] = (tags[t] || 0) + 1;
  }
  return { total: records.length, active: records.length - deleted, deleted, tags };
}

/** Escapes special regex characters in a string */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calculates relevance score for a record against a query.
 *
 * Scoring formula:
 * - +5 points per keyword match in text
 * - +8 points per tag match
 * - +6 points per extracted keyword match
 * - +0-5 points for recency (newer = higher)
 *
 * @param r - The memory record to score
 * @param query - The search query
 * @returns Numeric relevance score (0 = no match)
 */
function scoreRecord(r: MemoryRecord, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const text = (r.text || "").toLowerCase();
  let score = 0;

  const tokens = q.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    const re = new RegExp(escapeRe(tok), "g");
    const hits = text.match(re)?.length || 0;
    score += hits * 5;
    // Tag match bonus
    if (r.tags.some((t) => t.toLowerCase() === tok)) score += 8;
    // Keyword match bonus (extracted keywords are pre-indexed)
    if (r.keywords?.some((k) => k === tok)) score += 6;
  }

  const ageMs = Date.now() - Date.parse(r.updatedAt || r.createdAt);
  const days = ageMs / (1000 * 60 * 60 * 24);
  const recency = Math.max(0, 5 - Math.min(5, days / 30));
  score += recency;

  return score;
}

/**
 * Searches memories by query with relevance ranking.
 *
 * @param records - Array of memory records to search
 * @param query - Search query (space-separated keywords)
 * @param limit - Maximum results to return (default 10)
 * @returns Array of search hits sorted by score descending
 */
export function search(records: MemoryRecord[], query: string, limit = 10): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const r of records) {
    if (r.deletedAt) continue;
    const s = scoreRecord(r, query);
    if (s <= 0) continue;
    hits.push({ id: r.id, text: r.text, tags: r.tags, keywords: r.keywords || [], createdAt: r.createdAt, updatedAt: r.updatedAt, score: s });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, Math.max(1, limit));
}

/**
 * Exports all records as formatted JSON string.
 *
 * @param records - Array of memory records
 * @returns Pretty-printed JSON string
 */
export function exportJson(records: MemoryRecord[]): string {
  return JSON.stringify(records, null, 2) + "\n";
}

/**
 * Formats search results as prettified markdown for display.
 *
 * @param hits - Array of search hits
 * @param query - The original search query
 * @returns Markdown-formatted string
 */
export function formatSearchResults(hits: SearchHit[], query: string): string {
  if (hits.length === 0) {
    return `No memories found for "${query}".`;
  }

  const lines: string[] = [];
  lines.push(`## Memory Search: "${query}"`);
  lines.push(`Found ${hits.length} relevant ${hits.length === 1 ? "memory" : "memories"}:\n`);

  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const relevance = h.score >= 20 ? "high" : h.score >= 10 ? "medium" : "low";

    lines.push(`### ${i + 1}. ${h.text}`);

    const meta: string[] = [];
    if (h.tags.length) meta.push(`Tags: ${h.tags.join(", ")}`);
    if (h.keywords.length) meta.push(`Keywords: ${h.keywords.slice(0, 5).join(", ")}`);
    meta.push(`Relevance: ${relevance} (${h.score.toFixed(1)})`);
    meta.push(`ID: \`${h.id}\``);

    lines.push(meta.join(" | "));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Compresses relevant memories into a budget-constrained markdown block.
 * Uses deterministic truncation (no LLM) - includes memories until budget exhausted.
 *
 * @param opts.records - Array of memory records
 * @param opts.query - Search query to find relevant memories
 * @param opts.budget - Maximum characters for output (min 200)
 * @param opts.limit - Maximum memories to consider (default 25)
 * @returns CompressResult with markdown and metadata
 */
export function compressDeterministic(opts: { records: MemoryRecord[]; query: string; budget: number; limit?: number }): CompressResult {
  const budget = Math.max(200, opts.budget);
  const limit = Math.max(1, opts.limit ?? 25);
  const hits = search(opts.records, opts.query, limit);

  const lines: string[] = [];
  lines.push("# Copilot Context (auto)");
  lines.push("");
  lines.push("## Relevant memory");
  for (const h of hits) {
    const tagStr = h.tags.length ? ` [${h.tags.join(", ")}]` : "";
    lines.push(`- (${h.id})${tagStr} ${h.text}`);
  }

  const md = lines.join("\n") + "\n";
  if (md.length <= budget) return { markdown: md, included: hits, budget, used: md.length };

  const out: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > budget) break;
    out.push(line);
    size += line.length + 1;
  }
  const md2 = out.join("\n") + "\n";
  return { markdown: md2, included: hits, budget, used: md2.length };
}
