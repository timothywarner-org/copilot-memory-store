/**
 * @fileoverview Interactive CLI for Copilot Memory Store.
 *
 * Provides a REPL (Read-Eval-Print Loop) interface for managing memories
 * directly from the terminal. Supports all memory operations with a
 * user-friendly command syntax.
 *
 * ## Commands
 * - `add [--tags a,b,c] <text>` - Store a new memory
 * - `search <query> [--limit N] [--raw]` - Search memories
 * - `compress --query <q> [--budget N] [--limit N] [--llm]` - Compress for context
 * - `delete <id>` - Soft-delete a memory
 * - `purge (--id | --match | --tag) [--dry-run]` - Hard-delete memories
 * - `export` - Dump all records as JSON
 * - `stats` - Show memory statistics
 * - `help` - Show available commands
 * - `exit` - Quit the CLI
 *
 * ## Usage
 * ```bash
 * npm run dev      # Run with tsx (development)
 * npm run start    # Run with tsx
 * node dist/cli.js # Run compiled version
 * ```
 *
 * @module cli
 */

import "dotenv/config";
import readline from "node:readline";
import process from "node:process";
import { addMemory, compressDeterministic, computeStats, exportJson, formatSearchResults, loadStore, purge, search, softDeleteById } from "./memoryStore.js";
import { deepSeekCompress } from "./deepseek.js";

/**
 * Parsed command structure from user input.
 * @typedef {Object} Parsed
 * @property {string} cmd - The command name (lowercase)
 * @property {string[]} args - Positional arguments
 * @property {Record<string, string | boolean>} opts - Named options (--key value)
 */
type Parsed = { cmd: string; args: string[]; opts: Record<string, string | boolean> };

/**
 * Tokenizes a command line string, handling quoted strings.
 *
 * Supports both single and double quotes with escape sequences.
 * Unquoted tokens are split by whitespace.
 *
 * @param line - Raw command line input
 * @returns Array of tokens with quotes removed and escapes processed
 *
 * @example
 * tokenize('add --tags a,b "hello world"')
 * // Returns: ['add', '--tags', 'a,b', 'hello world']
 */
function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const token = (m[1] ?? m[2] ?? m[3]) as string;
    out.push(token.replace(/\\"/g, '"').replace(/\\'/g, "'"));
  }
  return out;
}

/**
 * Parses a command line into command, arguments, and options.
 *
 * Options are specified with `--key value` or `--flag` syntax.
 * Remaining tokens become positional arguments.
 *
 * @param line - Raw command line input
 * @returns Parsed command structure, or null if line is empty
 *
 * @example
 * parse('search typescript --limit 5 --raw')
 * // Returns: { cmd: 'search', args: ['typescript'], opts: { limit: '5', raw: true } }
 */
function parse(line: string): Parsed | null {
  const tokens = tokenize(line.trim());
  if (tokens.length === 0) return null;
  const cmd = tokens[0].toLowerCase();
  const opts: Record<string, string | boolean> = {};
  const args: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const next = tokens[i + 1];
      if (!next || next.startsWith("--")) opts[key] = true;
      else { opts[key] = next; i += 1; }
    } else {
      args.push(t);
    }
  }
  return { cmd, args, opts };
}

/**
 * Prints available commands to the console.
 */
function printHelp(): void {
  console.log([
    "",
    "Commands:",
    "  add [--tags a,b,c] <text>",
    "  search <query> [--limit N] [--raw]",
    "  compress --query <q> [--budget N] [--limit N] [--llm]",
    "  delete <id>",
    "  purge (--id <id> | --match <substr> | --tag <tag>) [--dry-run]",
    "  export",
    "  stats",
    "  help",
    "  exit",
    ""
  ].join("\n"));
}

/**
 * Parses a comma-separated string into an array of trimmed values.
 *
 * @param s - Comma-separated string (e.g., "a,b,c")
 * @returns Array of non-empty trimmed values
 *
 * @example
 * parseCsv("react, typescript, testing")
 * // Returns: ['react', 'typescript', 'testing']
 */
function parseCsv(s: string | undefined): string[] {
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

/**
 * Safely parses an integer value with fallback.
 *
 * @param v - Value to parse (string or number)
 * @param fallback - Default value if parsing fails
 * @returns Parsed integer or fallback
 */
function getInt(v: any, fallback: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Handles the `add` command - stores a new memory.
 *
 * @param p - Parsed command with text in args and optional --tags
 *
 * @example
 * // add --tags react,patterns Always use custom hooks for shared logic
 */
async function cmdAdd(p: Parsed): Promise<void> {
  const tags = parseCsv(typeof p.opts.tags === "string" ? p.opts.tags : undefined);
  const text = p.args.join(" ").trim();
  if (!text) { console.log("❌ add requires text."); return; }
  const rec = await addMemory({ text, tags });
  console.log(`✅ Added ${rec.id}`);
}

/**
 * Handles the `search` command - searches memories by query.
 *
 * Outputs prettified markdown by default, or compact format with --raw.
 *
 * @param records - Current memory records
 * @param p - Parsed command with query in args, optional --limit and --raw
 *
 * @example
 * // search typescript --limit 5
 * // search "error handling" --raw
 */
function cmdSearch(records: any[], p: Parsed): void {
  const q = p.args.join(" ").trim();
  if (!q) { console.log("❌ search requires a query."); return; }
  const limit = getInt(p.opts.limit, 10);
  const raw = Boolean(p.opts.raw);
  const hits = search(records, q, limit);

  if (raw) {
    // Raw mode: compact format for scripting
    if (hits.length === 0) { console.log("∅ No matches."); return; }
    for (const h of hits) {
      const tagStr = h.tags.length ? ` [${h.tags.join(", ")}]` : "";
      console.log(`- ${h.id}${tagStr} (score ${h.score.toFixed(1)}) ${h.text}`);
    }
  } else {
    // Prettified markdown output
    console.log(formatSearchResults(hits, q));
  }
}

/**
 * Handles the `compress` command - creates budget-constrained context.
 *
 * Uses deterministic compression by default. With --llm flag and
 * DEEPSEEK_API_KEY set, uses LLM-assisted compression for smarter results.
 *
 * @param records - Current memory records
 * @param p - Parsed command with --query, optional --budget, --limit, --llm
 *
 * @example
 * // compress --query "react patterns" --budget 800
 * // compress --query "authentication" --llm
 */
async function cmdCompress(records: any[], p: Parsed): Promise<void> {
  const query = typeof p.opts.query === "string" ? p.opts.query : p.args.join(" ").trim();
  if (!query) { console.log("❌ compress requires --query <text> (or positional query)."); return; }

  const budget = getInt(p.opts.budget, 1200);
  const limit = getInt(p.opts.limit, 25);

  const det = compressDeterministic({ records, query, budget, limit });
  let md = det.markdown;

  const wantLLM = Boolean(p.opts.llm);
  const key = (process.env.DEEPSEEK_API_KEY || "").trim();
  if (wantLLM) {
    if (!key) {
      console.log("⚠️  --llm requested, but DEEPSEEK_API_KEY is not set. Using deterministic compression.");
    } else {
      const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
      const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
      md = await deepSeekCompress({ baseUrl, apiKey: key, model }, query, md, budget);
    }
  }

  console.log(md);
}

/**
 * Handles the `delete` command - soft-deletes a memory by ID.
 *
 * Sets a deletedAt timestamp (tombstone). Record remains in store
 * but is excluded from searches. Can be hard-deleted later with purge.
 *
 * @param p - Parsed command with memory ID in args[0]
 *
 * @example
 * // delete m_20241213T150000000Z_abc123
 */
async function cmdDelete(p: Parsed): Promise<void> {
  const id = p.args[0]?.trim();
  if (!id) { console.log("❌ delete requires an id."); return; }
  const res = await softDeleteById({ id });
  console.log(res.found ? `🗑️  Soft-deleted ${id}` : "∅ Not found.");
}

/**
 * Handles the `purge` command - hard-deletes memories permanently.
 *
 * Supports deletion by ID, tag, or substring match.
 * Use --dry-run to preview what would be deleted.
 *
 * @param p - Parsed command with --id, --tag, or --match, optional --dry-run
 *
 * @example
 * // purge --id m_20241213T150000000Z_abc123
 * // purge --tag temporary --dry-run
 * // purge --match "test data"
 */
async function cmdPurge(p: Parsed): Promise<void> {
  const id = typeof p.opts.id === "string" ? p.opts.id : undefined;
  const match = typeof p.opts.match === "string" ? p.opts.match : undefined;
  const tag = typeof p.opts.tag === "string" ? p.opts.tag : undefined;
  const dryRun = Boolean(p.opts["dry-run"]);
  const res = await purge({ id, match, tag, dryRun });
  console.log(dryRun ? `🔎 Dry run: would purge ${res.purged} memories:` : `🔥 Purged ${res.purged} memories:`);
  for (const mid of res.ids) console.log(`- ${mid}`);
}

/**
 * Handles the `export` command - dumps all records as JSON.
 *
 * Outputs complete store including soft-deleted (tombstoned) records.
 *
 * @param records - Current memory records
 */
function cmdExport(records: any[]): void {
  console.log(exportJson(records));
}

/**
 * Handles the `stats` command - shows memory statistics.
 *
 * Displays total, active, and deleted counts plus top tags by frequency.
 *
 * @param records - Current memory records
 */
function cmdStats(records: any[]): void {
  const s = computeStats(records);
  console.log(`total=${s.total} active=${s.active} deleted=${s.deleted}`);
  const entries = Object.entries(s.tags).sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (entries.length) {
    console.log("top tags:");
    for (const [k, v] of entries) console.log(`- ${k}: ${v}`);
  }
}

/**
 * Processes a single line of user input.
 *
 * Parses the command, reloads the store for fresh data,
 * and dispatches to the appropriate handler.
 *
 * @param line - Raw user input
 * @param state - Mutable state containing memory path and records
 * @returns true to continue REPL, false to exit
 */
async function handleLine(line: string, state: { memoryPath: string; records: any[] }): Promise<boolean> {
  const p = parse(line);
  if (!p) return true;

  if (p.cmd === "exit" || p.cmd === "quit") return false;
  if (p.cmd === "help" || p.cmd === "?") { printHelp(); return true; }

  const loaded = loadStore(state.memoryPath);
  state.records = loaded.records;

  try {
    switch (p.cmd) {
      case "add": await cmdAdd(p); break;
      case "search": cmdSearch(state.records, p); break;
      case "compress": await cmdCompress(state.records, p); break;
      case "delete": await cmdDelete(p); break;
      case "purge": await cmdPurge(p); break;
      case "export": cmdExport(state.records); break;
      case "stats": cmdStats(state.records); break;
      default: console.log(`❌ Unknown command: ${p.cmd}`); printHelp();
    }
  } catch (err: any) {
    console.log(`❌ Error: ${err?.message || String(err)}`);
  }

  return true;
}

/**
 * Main entry point - starts the interactive CLI REPL.
 *
 * Loads the memory store, displays status, and enters a readline loop
 * that processes commands until user types 'exit' or 'quit'.
 *
 * @example
 * ```
 * $ npm run dev
 * 📦 Loaded 42 memories
 * Type "help" for available commands, "exit" to quit.
 *
 * memory> search typescript
 * ```
 */
export async function main(): Promise<void> {
  const loaded = loadStore();
  const active = loaded.records.filter((r: any) => !r.deletedAt).length;
  console.log(`📦 Loaded ${active} memories`);
  console.log(`Type "help" for available commands, "exit" to quit.\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl.setPrompt("memory> ");
  rl.prompt(true);

  rl.on("line", async (line) => {
    const keep = await handleLine(line, { memoryPath: loaded.memoryPath, records: loaded.records });
    if (!keep) rl.close();
    else rl.prompt(true);
  });

  rl.on("close", () => process.exit(0));
}

// Always run main when this file is executed directly
main();
