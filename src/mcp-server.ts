/**
 * @fileoverview MCP Server for Copilot Memory Store.
 *
 * Exposes memory operations as MCP tools, resources, and prompts for use
 * with GitHub Copilot (Agent mode) or any MCP-compatible client.
 *
 * ## Tools (7)
 * - memory_write: Add a memory
 * - memory_search: Search with relevance scoring
 * - memory_compress: Budget-constrained context compression
 * - memory_delete: Soft-delete (tombstone)
 * - memory_purge: Hard-delete by criteria
 * - memory_export: Export raw JSON
 * - inject_context: Auto-inject shaped context for a task (uses DeepSeek LLM)
 *
 * ## Resources (2)
 * - memory://stats: Live statistics
 * - memory://recent: Last 10 memories
 *
 * ## Prompts (3)
 * - summarize-memories: Generate topic summary
 * - remember-decision: Structured ADR template
 * - inject-context: Auto-inject context for task (supports LLM shaping)
 *
 * @module mcp-server
 */

import "dotenv/config";
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { addMemory, compressDeterministic, computeStats, exportJson, formatSearchResults, loadStore, purge, search, softDeleteById } from "./memoryStore.js";
import { deepSeekCompress, deepSeekShape } from "./deepseek.js";

/**
 * Logs a message to stderr (stdout is reserved for JSON-RPC).
 * @param msg - Message to log
 */
function log(msg: string): void {
  process.stderr.write(`[copilot-memory] ${msg}\n`);
}

/** MCP server instance with name and version */
const server = new McpServer({ name: "copilot-memory-store", version: "0.2.0" });

// ─────────────────────────────────────────────────────────────
// MCP Tools - actions clients can invoke
// ─────────────────────────────────────────────────────────────

/**
 * Tool: memory_write
 * Adds a new memory to the store with optional tags.
 * Keywords are automatically extracted from the text.
 */
server.tool(
  "memory_write",
  "Add, save, store, or remember information to the project memory. Use this when the user wants to remember something, save a preference, store a decision, or add a note for later. Keywords: add, save, store, remember, note, record, keep.",
  {
    text: z.string().describe("Memory text to store."),
    tags: z.array(z.string()).optional().describe("Optional tags.")
  },
  async (args) => {
    const text = String(args.text ?? "").trim();
    const tags = Array.isArray(args.tags) ? args.tags.map((t) => String(t)) : undefined;
    const rec = await addMemory({ text, tags });
    return { content: [{ type: "text", text: `Added ${rec.id}` }] };
  }
);

/**
 * Tool: memory_search
 * Searches memories by keyword query with relevance scoring.
 * Returns prettified markdown by default, or raw JSON if requested.
 */
server.tool(
  "memory_search",
  "Search, find, recall, or look up information from project memory. Use this when the user asks what they stored, wants to find a memory, recall a decision, look up preferences, or asks 'what do I have about X'. Keywords: search, find, recall, lookup, what, show, list, get.",
  {
    query: z.string().describe("Search query."),
    limit: z.number().min(1).max(50).default(10).describe("Max results (1-50, default 10)."),
    raw: z.boolean().default(false).describe("Return raw JSON instead of formatted markdown.")
  },
  async (args) => {
    const q = String(args.query ?? "").trim();
    const limit = Number.isFinite(args.limit) ? Number(args.limit) : 10;
    const raw = Boolean(args.raw);
    const loaded = loadStore();
    const hits = search(loaded.records, q, limit);

    if (raw) {
      return { content: [{ type: "text", text: JSON.stringify({ matches: hits.length, hits }, null, 2) }] };
    }

    const formatted = formatSearchResults(hits, q);
    return { content: [{ type: "text", text: formatted }] };
  }
);

/**
 * Tool: memory_compress
 * Creates a budget-constrained markdown context block from relevant memories.
 * Optionally uses DeepSeek LLM for smarter compression.
 */
server.tool(
  "memory_compress",
  "Create a compact Markdown context block from relevant memories.",
  {
    query: z.string().describe("Search query."),
    budget: z.number().min(200).max(8000).default(1200).describe("Character budget (200-8000, default 1200)."),
    limit: z.number().min(1).max(50).default(25).describe("Max memories to consider (1-50, default 25)."),
    llm: z.boolean().default(false).describe("Use DeepSeek to further compress if configured.")
  },
  async (args) => {
    const query = String(args.query ?? "").trim();
    const budget = Number.isFinite(args.budget) ? Number(args.budget) : 1200;
    const limit = Number.isFinite(args.limit) ? Number(args.limit) : 25;
    const llm = Boolean(args.llm);

    const loaded = loadStore();
    const det = compressDeterministic({ records: loaded.records, query, budget, limit });
    let md = det.markdown;

    if (llm) {
      const key = (process.env.DEEPSEEK_API_KEY || "").trim();
      if (key) {
        const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
        const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
        md = await deepSeekCompress({ baseUrl, apiKey: key, model }, query, md, budget);
      }
    }

    return { content: [{ type: "text", text: md }] };
  }
);

/**
 * Tool: memory_delete
 * Soft-deletes a memory by ID (sets deletedAt timestamp).
 * Record remains in store but excluded from searches.
 */
server.tool(
  "memory_delete",
  "Soft-delete a memory by id (tombstone).",
  {
    id: z.string().describe("Memory ID to delete.")
  },
  async (args) => {
    const id = String(args.id ?? "").trim();
    const res = await softDeleteById({ id });
    return { content: [{ type: "text", text: res.found ? `Soft-deleted ${id}` : `Not found: ${id}` }] };
  }
);

/**
 * Tool: memory_purge
 * Hard-deletes memories matching criteria (permanently removes from file).
 * Supports dry-run mode to preview what would be deleted.
 */
server.tool(
  "memory_purge",
  "Hard-delete memories by id, tag, or substring match.",
  {
    id: z.string().optional().describe("Memory ID to purge."),
    tag: z.string().optional().describe("Tag to match for purge."),
    match: z.string().optional().describe("Substring to match for purge."),
    dryRun: z.boolean().default(false).describe("Preview without deleting.")
  },
  async (args) => {
    const id = typeof args.id === "string" ? args.id : undefined;
    const tag = typeof args.tag === "string" ? args.tag : undefined;
    const match = typeof args.match === "string" ? args.match : undefined;
    const dryRun = Boolean(args.dryRun);
    const res = await purge({ id, tag, match, dryRun });
    return { content: [{ type: "text", text: dryRun ? `Would purge ${res.purged}` : `Purged ${res.purged}` }] };
  }
);

/**
 * Tool: memory_export
 * Exports all memory records as raw JSON (including soft-deleted).
 */
server.tool(
  "memory_export",
  "Export the raw JSON memory file (including tombstoned items).",
  {},
  async () => {
    const loaded = loadStore();
    const raw = exportJson(loaded.records);
    return { content: [{ type: "text", text: raw }] };
  }
);

/**
 * Tool: inject_context
 * Automatically injects relevant memories as shaped context for a task.
 *
 * This tool is designed for autonomous use by LLMs. When starting a coding task,
 * the LLM can call this tool to retrieve relevant project context (decisions,
 * preferences, patterns, constraints) shaped specifically for the task at hand.
 *
 * Uses DeepSeek LLM to intelligently transform raw memories into actionable
 * guidance. Falls back to deterministic compression if DeepSeek is not configured.
 *
 * @returns Markdown context block optimized for the given task
 */
server.tool(
  "inject_context",
  "Inject relevant project context for a coding task. Call this BEFORE starting work to retrieve decisions, preferences, and constraints relevant to the task. Uses AI to shape context into actionable guidance. Keywords: context, inject, before, start, relevant, decisions, preferences, constraints.",
  {
    task: z.string().describe("The coding task you are about to work on (be specific for better context matching)."),
    budget: z.number().min(200).max(8000).default(1500).describe("Character budget for context (200-8000, default 1500)."),
    limit: z.number().min(1).max(50).default(25).describe("Max memories to consider (1-50, default 25).")
  },
  async (args) => {
    const task = String(args.task ?? "").trim();
    if (!task) {
      return {
        content: [{ type: "text", text: "Error: task parameter is required. Describe what you're about to work on." }],
        isError: true
      };
    }

    const budget = Number.isFinite(args.budget) ? Number(args.budget) : 1500;
    const limit = Number.isFinite(args.limit) ? Number(args.limit) : 25;

    const loaded = loadStore();
    const compressed = compressDeterministic({ records: loaded.records, query: task, budget, limit });

    // Check if we have any relevant memories
    const memoryCount = compressed.included.length;
    if (memoryCount === 0) {
      return {
        content: [{
          type: "text",
          text: `## No Relevant Context Found\n\nNo stored memories matched the task: "${task}"\n\nProceed with your best judgment, and consider using \`memory_write\` to store relevant decisions for future reference.`
        }]
      };
    }

    let contextBlock = compressed.markdown;
    let shapingMethod = "deterministic";

    // Attempt DeepSeek shaping for intelligent context transformation
    const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim();
    if (apiKey) {
      const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
      const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
      try {
        contextBlock = await deepSeekShape({ baseUrl, apiKey, model }, task, compressed.markdown, budget);
        shapingMethod = "deepseek";
      } catch (err) {
        // Log error but continue with deterministic fallback
        log(`DeepSeek shaping failed, using deterministic: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Add metadata footer for transparency
    const footer = `\n\n---\n_Context shaped via ${shapingMethod} | ${memoryCount} memories | ${contextBlock.length} chars_`;

    return {
      content: [{ type: "text", text: contextBlock + footer }]
    };
  }
);

// ─────────────────────────────────────────────────────────────
// MCP Resources - data endpoints clients can fetch proactively
// ─────────────────────────────────────────────────────────────

/**
 * Resource: memory://stats
 * Returns live statistics about the memory store including counts and top tags.
 */
server.resource(
  "stats",
  "memory://stats",
  { description: "Live statistics about the memory store", mimeType: "text/markdown" },
  async () => {
    const loaded = loadStore();
    const s = computeStats(loaded.records);

    const lines: string[] = [];
    lines.push("# Memory Store Stats\n");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total memories | ${s.total} |`);
    lines.push(`| Active | ${s.active} |`);
    lines.push(`| Deleted | ${s.deleted} |`);

    const tagEntries = Object.entries(s.tags).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (tagEntries.length > 0) {
      lines.push("\n## Top Tags\n");
      lines.push(`| Tag | Count |`);
      lines.push(`|-----|-------|`);
      for (const [tag, count] of tagEntries) {
        lines.push(`| ${tag} | ${count} |`);
      }
    }

    return { contents: [{ uri: "memory://stats", mimeType: "text/markdown", text: lines.join("\n") }] };
  }
);

/**
 * Resource: memory://recent
 * Returns the 10 most recently added memories.
 */
server.resource(
  "recent",
  "memory://recent",
  { description: "Most recently added memories (last 10)", mimeType: "text/markdown" },
  async () => {
    const loaded = loadStore();
    const active = loaded.records
      .filter(r => !r.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const lines: string[] = [];
    lines.push("# Recent Memories\n");

    if (active.length === 0) {
      lines.push("_No memories stored yet._");
    } else {
      for (const r of active) {
        const date = new Date(r.createdAt).toLocaleString();
        const tagStr = r.tags.length ? ` [${r.tags.join(", ")}]` : "";
        lines.push(`- **${date}**${tagStr}: ${r.text}`);
      }
    }

    return { contents: [{ uri: "memory://recent", mimeType: "text/markdown", text: lines.join("\n") }] };
  }
);

// ─────────────────────────────────────────────────────────────
// MCP Prompts - reusable prompt templates for common workflows
// ─────────────────────────────────────────────────────────────

/**
 * Prompt: summarize-memories
 * Generates a user message asking the LLM to summarize memories on a topic.
 * Automatically searches for relevant memories and includes them as context.
 */
server.prompt(
  "summarize-memories",
  "Generate a summary of memories related to a topic",
  { topic: z.string().describe("The topic to summarize memories about") },
  async (args) => {
    const topic = String(args.topic ?? "").trim();
    const loaded = loadStore();
    const hits = search(loaded.records, topic, 15);

    const memoryContext = hits.length > 0
      ? hits.map(h => `- ${h.text}${h.tags.length ? ` [${h.tags.join(", ")}]` : ""}`).join("\n")
      : "_No memories found for this topic._";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please summarize my stored memories about "${topic}". Here are the relevant memories:\n\n${memoryContext}\n\nProvide a concise summary highlighting key themes, decisions, and preferences.`
          }
        }
      ]
    };
  }
);

/**
 * Prompt: remember-decision
 * Structured template for capturing architectural/design decisions (ADRs).
 * Generates a message asking the LLM to store it via memory_write.
 */
server.prompt(
  "remember-decision",
  "Template for capturing an architectural or design decision",
  {
    title: z.string().describe("Short title for the decision"),
    context: z.string().describe("Why this decision was needed"),
    decision: z.string().describe("What was decided"),
    consequences: z.string().optional().describe("Expected outcomes or trade-offs")
  },
  async (args) => {
    const title = String(args.title ?? "").trim();
    const context = String(args.context ?? "").trim();
    const decision = String(args.decision ?? "").trim();
    const consequences = args.consequences ? String(args.consequences).trim() : "";

    const parts = [
      `**Decision: ${title}**`,
      `Context: ${context}`,
      `Decision: ${decision}`
    ];
    if (consequences) {
      parts.push(`Consequences: ${consequences}`);
    }

    const memoryText = parts.join(" | ");

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please store this architectural decision as a memory with tags [decision, architecture]:\n\n${memoryText}\n\nUse the memory_write tool to save this.`
          }
        }
      ]
    };
  }
);

/**
 * Prompt: inject-context
 * Auto-injects relevant memories as context for a task.
 * Supports optional LLM-powered shaping via DeepSeek for better task alignment.
 *
 * When `shape: true`, uses DeepSeek to intelligently restructure the context
 * into actionable guidance specifically tailored for the task.
 */
server.prompt(
  "inject-context",
  "Inject relevant memories as context for a task. Use shape=true for LLM-optimized context.",
  {
    task: z.string().describe("The task you need help with"),
    budget: z.number().optional().describe("Character budget for context (default 1200)"),
    shape: z.boolean().optional().describe("Use DeepSeek to shape context for the task (default false)")
  },
  async (args) => {
    const task = String(args.task ?? "").trim();
    const budget = Number.isFinite(args.budget) ? Number(args.budget) : 1200;
    const shape = Boolean(args.shape);

    const loaded = loadStore();
    const compressed = compressDeterministic({ records: loaded.records, query: task, budget, limit: 25 });

    let contextBlock = compressed.markdown;

    // If shaping is requested and DeepSeek is configured, transform the context
    if (shape) {
      const key = (process.env.DEEPSEEK_API_KEY || "").trim();
      if (key) {
        const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
        const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
        try {
          contextBlock = await deepSeekShape({ baseUrl, apiKey: key, model }, task, compressed.markdown, budget);
        } catch (err) {
          // Fall back to deterministic compression on error
          log(`DeepSeek shaping failed, using deterministic: ${err}`);
        }
      }
    }

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `${contextBlock}\n\n---\n\nUsing the context above, help me with: ${task}`
          }
        }
      ]
    };
  }
);

// ─────────────────────────────────────────────────────────────
// Server startup
// ─────────────────────────────────────────────────────────────

/**
 * Starts the MCP server with stdio transport.
 * Logs status to stderr since stdout is used for JSON-RPC.
 */
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  log("Starting MCP stdio server...");
  await server.connect(transport);
  log("MCP server connected.");
}

main().catch((err) => {
  log(`Fatal: ${err?.message || String(err)}`);
  process.exit(1);
});
