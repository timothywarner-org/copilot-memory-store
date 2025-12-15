/**
 * @fileoverview MCP Server for Copilot Memory Store.
 *
 * A feature-rich Model Context Protocol server that provides persistent memory
 * capabilities for AI assistants and coding agents. This server demonstrates
 * best practices for MCP implementation including rich annotations, elicitations,
 * and comprehensive resource/prompt definitions.
 *
 * ## Tools (7)
 * - memory_write: Add a memory with optional tags (supports elicitation for tag selection)
 * - memory_search: Search with relevance scoring (read-only, idempotent)
 * - memory_compress: Budget-constrained context compression (read-only)
 * - memory_delete: Soft-delete by ID (tombstone, reversible)
 * - memory_purge: Hard-delete by criteria (destructive, supports confirmation elicitation)
 * - memory_export: Export raw JSON (read-only)
 * - inject_context: Auto-inject shaped context for a task (read-only, uses DeepSeek LLM)
 *
 * ## Resources (2)
 * - memory://stats: Live statistics about the memory store
 * - memory://recent: Last 10 memories for quick reference
 *
 * ## Prompts (3)
 * - summarize-memories: Generate topic summary from stored memories
 * - remember-decision: Structured ADR (Architecture Decision Record) template
 * - inject-context: Auto-inject context for task (supports LLM shaping)
 *
 * ## Elicitations
 * - memory_purge: Requests user confirmation before permanent deletion
 * - memory_write: Offers existing tags for selection (when tags exist)
 *
 * @module mcp-server
 * @version 0.3.0
 * @see https://modelcontextprotocol.io/
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

/**
 * MCP server instance with name, version, and capabilities.
 *
 * This server provides a complete memory management system with:
 * - Full CRUD operations for memories
 * - Smart search with relevance scoring
 * - Context compression for LLM consumption
 * - Elicitation support for interactive workflows
 */
const server = new McpServer(
  { name: "copilot-memory-store", version: "0.3.0" },
  {
    capabilities: {},
    instructions: `
# Copilot Memory Store

A persistent memory system for AI assistants. Use this to remember decisions,
preferences, patterns, and context across conversations.

## Quick Start
- **Save something**: Use \`memory_write\` with text and optional tags
- **Find memories**: Use \`memory_search\` with a query
- **Get context**: Use \`inject_context\` before starting a task

## Best Practices
- Tag memories for better organization (e.g., "architecture", "preference", "decision")
- Use \`inject_context\` at the start of tasks to retrieve relevant context
- Periodically review with \`memory://stats\` and \`memory://recent\` resources

## Elicitation Support
Some tools support interactive elicitation:
- \`memory_purge\`: Will ask for confirmation before permanent deletion
- \`memory_write\`: May suggest existing tags for consistency

Not all MCP clients support elicitation - tools will still work without it.
    `.trim()
  }
);

// ─────────────────────────────────────────────────────────────
// MCP Tools - actions clients can invoke
// ─────────────────────────────────────────────────────────────

/**
 * Tool: memory_write
 *
 * Adds a new memory to the store with optional tags. Keywords are automatically
 * extracted from the text for search indexing.
 *
 * **Elicitation**: When existing tags are available and the client supports
 * elicitation, the user may be offered a selection of existing tags for consistency.
 *
 * @example
 * // Simple memory
 * memory_write({ text: "Use TypeScript strict mode" })
 *
 * // Memory with tags
 * memory_write({ text: "API uses REST conventions", tags: ["architecture", "api"] })
 */
server.registerTool(
  "memory_write",
  {
    title: "Write Memory",
    description: "Add, save, store, or remember information to the project memory. Use this when the user wants to remember something, save a preference, store a decision, or add a note for later. Keywords: add, save, store, remember, note, record, keep.",
    inputSchema: {
      text: z.string().min(1).describe("The memory text to store. Be descriptive - this will be searchable later."),
      tags: z.array(z.string()).optional().describe("Optional tags for categorization (e.g., 'decision', 'preference', 'architecture'). Helps with organization and filtering."),
      suggestTags: z.boolean().optional().describe("If true and elicitation is supported, suggest existing tags to choose from.")
    },
    annotations: {
      title: "Write Memory",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  async (args) => {
    const text = String(args.text ?? "").trim();
    let tags = Array.isArray(args.tags) ? args.tags.map((t) => String(t)) : undefined;
    const suggestTags = Boolean(args.suggestTags);

    // If suggestTags is requested, try elicitation for tag selection
    if (suggestTags && (!tags || tags.length === 0)) {
      try {
        const loaded = loadStore();
        const stats = computeStats(loaded.records);
        const existingTags = Object.keys(stats.tags).slice(0, 10);

        if (existingTags.length >= 2) {
          // Attempt elicitation - will fail gracefully if client doesn't support it
          const result = await server.server.elicitInput({
            mode: "form",
            message: "Select tags for this memory (optional):",
            requestedSchema: {
              type: "object",
              properties: {
                selectedTags: {
                  type: "array",
                  title: "Tags",
                  description: "Select from existing tags or leave empty",
                  items: {
                    type: "string",
                    enum: existingTags
                  },
                  minItems: 0,
                  maxItems: 5
                },
                customTag: {
                  type: "string",
                  title: "Custom Tag",
                  description: "Or add a new tag (optional)"
                }
              }
            }
          });

          if (result.action === "accept" && result.content) {
            const selected = (result.content.selectedTags as string[]) || [];
            const custom = result.content.customTag as string;
            tags = [...selected];
            if (custom && custom.trim()) {
              tags.push(custom.trim());
            }
          }
        }
      } catch {
        // Elicitation not supported or failed - continue without it
        log("Tag elicitation not available, proceeding without tag suggestions");
      }
    }

    const rec = await addMemory({ text, tags });
    const tagInfo = rec.tags.length > 0 ? ` with tags [${rec.tags.join(", ")}]` : "";
    return {
      content: [{
        type: "text",
        text: `✓ Memory saved (${rec.id})${tagInfo}\n\nKeywords extracted: ${rec.keywords.slice(0, 5).join(", ")}${rec.keywords.length > 5 ? "..." : ""}`
      }]
    };
  }
);

/**
 * Tool: memory_search
 *
 * Searches memories by keyword query with relevance scoring. Results are
 * ranked by keyword matches, tag matches, and recency.
 *
 * This is a **read-only** operation that does not modify the store.
 *
 * @example
 * // Find architecture decisions
 * memory_search({ query: "architecture patterns" })
 *
 * // Get raw JSON for programmatic processing
 * memory_search({ query: "API design", raw: true, limit: 5 })
 */
server.registerTool(
  "memory_search",
  {
    title: "Search Memories",
    description: "Search, find, recall, or look up information from project memory. Use this when the user asks what they stored, wants to find a memory, recall a decision, look up preferences, or asks 'what do I have about X'. Keywords: search, find, recall, lookup, what, show, list, get.",
    inputSchema: {
      query: z.string().min(1).describe("Search query - matches against memory text, keywords, and tags."),
      limit: z.number().min(1).max(50).default(10).describe("Maximum results to return (1-50, default 10)."),
      raw: z.boolean().default(false).describe("Return raw JSON instead of formatted markdown. Useful for programmatic processing.")
    },
    annotations: {
      title: "Search Memories",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
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
 *
 * Creates a budget-constrained markdown context block from relevant memories.
 * Useful for injecting context into LLM prompts without exceeding token limits.
 *
 * This is a **read-only** operation that does not modify the store.
 *
 * @example
 * // Basic compression
 * memory_compress({ query: "testing strategy" })
 *
 * // With LLM enhancement
 * memory_compress({ query: "API design", llm: true, budget: 2000 })
 */
server.registerTool(
  "memory_compress",
  {
    title: "Compress Context",
    description: "Create a compact Markdown context block from relevant memories, constrained to a character budget. Ideal for injecting context into LLM prompts.",
    inputSchema: {
      query: z.string().min(1).describe("Search query to find relevant memories."),
      budget: z.number().min(200).max(8000).default(1200).describe("Character budget for output (200-8000, default 1200)."),
      limit: z.number().min(1).max(50).default(25).describe("Max memories to consider before compression (1-50, default 25)."),
      llm: z.boolean().default(false).describe("Use DeepSeek LLM for smarter compression. Requires DEEPSEEK_API_KEY env var.")
    },
    annotations: {
      title: "Compress Context",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
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
 *
 * Soft-deletes a memory by ID (sets deletedAt timestamp). The record remains
 * in the store but is excluded from searches. This is **reversible** - the
 * memory can be recovered by editing the JSON file directly.
 *
 * For permanent deletion, use `memory_purge` instead.
 *
 * @example
 * memory_delete({ id: "mem_abc123" })
 */
server.registerTool(
  "memory_delete",
  {
    title: "Delete Memory (Soft)",
    description: "Soft-delete a memory by ID (tombstone). The memory is marked as deleted but remains in storage and can be recovered. Use memory_purge for permanent deletion.",
    inputSchema: {
      id: z.string().min(1).describe("Memory ID to soft-delete (e.g., 'mem_abc123').")
    },
    annotations: {
      title: "Delete Memory (Soft)",
      readOnlyHint: false,
      destructiveHint: false, // Soft delete is reversible
      idempotentHint: true,   // Deleting same ID twice has same effect
      openWorldHint: false
    }
  },
  async (args) => {
    const id = String(args.id ?? "").trim();
    const res = await softDeleteById({ id });
    return {
      content: [{
        type: "text",
        text: res.found
          ? `✓ Soft-deleted memory ${id}\n\nThe memory is now hidden from searches but can be recovered from the JSON file.`
          : `✗ Memory not found: ${id}`
      }]
    };
  }
);

/**
 * Tool: memory_purge
 *
 * Hard-deletes memories matching criteria (permanently removes from file).
 * This is a **DESTRUCTIVE** operation that cannot be undone!
 *
 * **Elicitation**: When the client supports elicitation and this is not a
 * dry-run, the user will be asked to confirm before deletion proceeds.
 *
 * @example
 * // Preview what would be deleted
 * memory_purge({ tag: "temp", dryRun: true })
 *
 * // Actually delete (will prompt for confirmation)
 * memory_purge({ tag: "temp" })
 */
server.registerTool(
  "memory_purge",
  {
    title: "Purge Memories (Hard Delete)",
    description: "PERMANENTLY delete memories by id, tag, or substring match. This is destructive and cannot be undone! Use dryRun: true to preview first. Will request confirmation via elicitation if supported.",
    inputSchema: {
      id: z.string().optional().describe("Memory ID to purge (exact match)."),
      tag: z.string().optional().describe("Tag to match - all memories with this tag will be purged."),
      match: z.string().optional().describe("Substring to match in memory text."),
      dryRun: z.boolean().default(false).describe("Preview what would be deleted without actually deleting. HIGHLY RECOMMENDED to use first!"),
      skipConfirmation: z.boolean().optional().describe("Skip the confirmation elicitation (use with caution).")
    },
    annotations: {
      title: "Purge Memories (Hard Delete)",
      readOnlyHint: false,
      destructiveHint: true,  // This is destructive!
      idempotentHint: true,   // Running twice with same criteria has same effect
      openWorldHint: false
    }
  },
  async (args) => {
    const id = typeof args.id === "string" ? args.id : undefined;
    const tag = typeof args.tag === "string" ? args.tag : undefined;
    const match = typeof args.match === "string" ? args.match : undefined;
    const dryRun = Boolean(args.dryRun);
    const skipConfirmation = Boolean(args.skipConfirmation);

    // First, always do a dry run to see what would be deleted
    const preview = await purge({ id, tag, match, dryRun: true });

    if (preview.purged === 0) {
      return {
        content: [{
          type: "text",
          text: "No memories match the specified criteria. Nothing to purge."
        }]
      };
    }

    if (dryRun) {
      return {
        content: [{
          type: "text",
          text: `🔍 **Dry Run Preview**\n\nWould permanently delete ${preview.purged} memory/memories.\n\nTo proceed, run again with \`dryRun: false\`.`
        }]
      };
    }

    // If not skipping confirmation, try elicitation
    if (!skipConfirmation) {
      try {
        const criteriaDesc = [
          id && `ID: ${id}`,
          tag && `Tag: ${tag}`,
          match && `Match: "${match}"`
        ].filter(Boolean).join(", ");

        const result = await server.server.elicitInput({
          mode: "form",
          message: `⚠️ PERMANENT DELETION\n\nYou are about to permanently delete ${preview.purged} memory/memories.\nCriteria: ${criteriaDesc}\n\nThis action cannot be undone!`,
          requestedSchema: {
            type: "object",
            properties: {
              confirm: {
                type: "boolean",
                title: "Confirm Deletion",
                description: `Type 'true' to confirm you want to permanently delete ${preview.purged} memory/memories`,
                default: false
              }
            },
            required: ["confirm"]
          }
        });

        if (result.action !== "accept" || !result.content?.confirm) {
          return {
            content: [{
              type: "text",
              text: "❌ Purge cancelled. No memories were deleted."
            }]
          };
        }
      } catch {
        // Elicitation not supported - proceed with a warning
        log("Elicitation not available for purge confirmation, proceeding with deletion");
      }
    }

    // Perform the actual deletion
    const res = await purge({ id, tag, match, dryRun: false });
    return {
      content: [{
        type: "text",
        text: `🗑️ **Purged ${res.purged} memory/memories**\n\nThis action is permanent and cannot be undone.`
      }]
    };
  }
);

/**
 * Tool: memory_export
 *
 * Exports all memory records as raw JSON, including soft-deleted items.
 * Useful for backup, migration, or debugging purposes.
 *
 * This is a **read-only** operation.
 *
 * @example
 * memory_export({})
 */
server.registerTool(
  "memory_export",
  {
    title: "Export All Memories",
    description: "Export the complete memory store as raw JSON, including soft-deleted (tombstoned) items. Useful for backup, migration, or debugging.",
    inputSchema: {},
    annotations: {
      title: "Export All Memories",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async () => {
    const loaded = loadStore();
    const raw = exportJson(loaded.records);
    const stats = computeStats(loaded.records);
    return {
      content: [{
        type: "text",
        text: `📦 **Memory Export**\n\nTotal: ${stats.total} | Active: ${stats.active} | Deleted: ${stats.deleted}\n\n\`\`\`json\n${raw}\n\`\`\``
      }]
    };
  }
);

/**
 * Tool: inject_context
 *
 * Automatically injects relevant memories as shaped context for a task.
 * This is the **recommended** way to retrieve project context before starting work.
 *
 * The tool searches for relevant memories based on the task description, then
 * optionally uses DeepSeek LLM to intelligently reshape the context into
 * actionable guidance specifically tailored for the task.
 *
 * This is a **read-only** operation.
 *
 * @example
 * // Before implementing a feature
 * inject_context({ task: "implement user authentication with OAuth" })
 *
 * // With larger budget for complex tasks
 * inject_context({ task: "refactor the database layer", budget: 3000 })
 */
server.registerTool(
  "inject_context",
  {
    title: "Inject Task Context",
    description: "Inject relevant project context for a coding task. Call this BEFORE starting work to retrieve decisions, preferences, and constraints relevant to the task. Uses AI to shape context into actionable guidance when configured. Keywords: context, inject, before, start, relevant, decisions, preferences, constraints.",
    inputSchema: {
      task: z.string().min(1).describe("The coding task you are about to work on. Be specific for better context matching (e.g., 'implement user authentication' vs just 'auth')."),
      budget: z.number().min(200).max(8000).default(1500).describe("Character budget for context output (200-8000, default 1500)."),
      limit: z.number().min(1).max(50).default(25).describe("Maximum memories to consider for context (1-50, default 25).")
    },
    annotations: {
      title: "Inject Task Context",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
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
    const footer = `\n\n---\n_Context: ${shapingMethod} shaping | ${memoryCount} memories | ${contextBlock.length} chars_`;

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
 *
 * Returns live statistics about the memory store including total counts,
 * active vs deleted breakdown, and top tags by usage.
 *
 * Useful for understanding the current state of the memory store and
 * identifying commonly used tags for organization.
 *
 * @returns Markdown table with statistics
 */
server.registerResource(
  "stats",
  "memory://stats",
  {
    description: "Live statistics about the memory store. Shows total/active/deleted counts and top 10 tags by usage. Refresh anytime to get current state.",
    mimeType: "text/markdown"
  },
  async () => {
    const loaded = loadStore();
    const s = computeStats(loaded.records);

    const lines: string[] = [];
    lines.push("# Memory Store Statistics\n");
    lines.push("Real-time overview of your memory store.\n");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total memories | ${s.total} |`);
    lines.push(`| Active | ${s.active} |`);
    lines.push(`| Soft-deleted | ${s.deleted} |`);

    const tagEntries = Object.entries(s.tags).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (tagEntries.length > 0) {
      lines.push("\n## Top 10 Tags\n");
      lines.push("Most frequently used tags for organizing memories.\n");
      lines.push(`| Tag | Usage Count |`);
      lines.push(`|-----|-------------|`);
      for (const [tag, count] of tagEntries) {
        lines.push(`| \`${tag}\` | ${count} |`);
      }
    } else {
      lines.push("\n_No tags in use yet. Add tags to memories for better organization._");
    }

    return { contents: [{ uri: "memory://stats", mimeType: "text/markdown", text: lines.join("\n") }] };
  }
);

/**
 * Resource: memory://recent
 *
 * Returns the 10 most recently added memories, sorted by creation date.
 * Quick way to see what was recently stored without searching.
 *
 * Does not include soft-deleted memories.
 *
 * @returns Markdown list of recent memories with dates and tags
 */
server.registerResource(
  "recent",
  "memory://recent",
  {
    description: "The 10 most recently added memories, sorted by creation date. Quick reference for recent context. Does not include deleted memories.",
    mimeType: "text/markdown"
  },
  async () => {
    const loaded = loadStore();
    const active = loaded.records
      .filter(r => !r.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const lines: string[] = [];
    lines.push("# Recent Memories\n");
    lines.push("Last 10 memories added to the store.\n");

    if (active.length === 0) {
      lines.push("_No memories stored yet._\n");
      lines.push("Use `memory_write` to add your first memory!");
    } else {
      for (const r of active) {
        const date = new Date(r.createdAt).toLocaleDateString();
        const time = new Date(r.createdAt).toLocaleTimeString();
        const tagStr = r.tags.length ? ` \`[${r.tags.join(", ")}]\`` : "";
        lines.push(`### ${date} at ${time}${tagStr}`);
        lines.push(`> ${r.text}`);
        lines.push(`_ID: ${r.id}_\n`);
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
 *
 * Generates a user message asking the LLM to summarize memories on a topic.
 * Automatically searches for relevant memories (up to 15) and includes them
 * as context for the summary request.
 *
 * Useful for getting an overview of stored knowledge on a particular subject.
 *
 * @param topic - The topic to summarize memories about
 * @returns User message with memory context for summarization
 */
server.registerPrompt(
  "summarize-memories",
  {
    title: "Summarize Memories",
    description: "Generate a summary of stored memories related to a topic. Searches for relevant memories and asks for key themes, decisions, and preferences to be highlighted.",
    argsSchema: {
      topic: z.string().min(1).describe("The topic to summarize memories about (e.g., 'API design', 'testing strategy', 'authentication').")
    }
  },
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
            text: `Please summarize my stored memories about "${topic}". Here are the relevant memories:\n\n${memoryContext}\n\nProvide a concise summary highlighting:\n1. Key themes and patterns\n2. Important decisions made\n3. Stated preferences or constraints\n4. Any actionable takeaways`
          }
        }
      ]
    };
  }
);

/**
 * Prompt: remember-decision
 *
 * Structured template for capturing architectural/design decisions using the
 * ADR (Architecture Decision Record) format. Creates a well-formatted memory
 * that can be easily retrieved later.
 *
 * The generated message asks the LLM to store the decision via memory_write
 * with appropriate tags.
 *
 * @param title - Short title for the decision
 * @param context - Why this decision was needed
 * @param decision - What was decided
 * @param consequences - Expected outcomes or trade-offs (optional)
 */
server.registerPrompt(
  "remember-decision",
  {
    title: "Remember Decision (ADR)",
    description: "Capture an architectural or design decision using the ADR format. Structures the decision with context, rationale, and consequences for future reference.",
    argsSchema: {
      title: z.string().min(1).describe("Short, descriptive title for the decision (e.g., 'Use PostgreSQL for persistence')."),
      context: z.string().min(1).describe("Why this decision was needed - the problem or situation that prompted it."),
      decision: z.string().min(1).describe("What was decided - the chosen approach or solution."),
      consequences: z.string().optional().describe("Expected outcomes, trade-offs, or things to watch for (optional but recommended).")
    }
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
            text: `Please store this architectural decision as a memory with tags [decision, architecture]:\n\n${memoryText}\n\nUse the memory_write tool to save this decision for future reference.`
          }
        }
      ]
    };
  }
);

/**
 * Prompt: inject-context
 *
 * Auto-injects relevant memories as context for a task. This is the prompt
 * version of the `inject_context` tool, useful when you want the context
 * delivered as a conversation message rather than a tool response.
 *
 * Supports optional LLM-powered shaping via DeepSeek for better task alignment.
 * When `shape: true`, uses DeepSeek to intelligently restructure the context
 * into actionable guidance specifically tailored for the task.
 *
 * @param task - The task you need help with
 * @param budget - Character budget for context (default 1200)
 * @param shape - Use DeepSeek to shape context (default false)
 */
server.registerPrompt(
  "inject-context",
  {
    title: "Inject Context for Task",
    description: "Inject relevant memories as context for a coding task. Use shape=true for AI-optimized context that transforms raw memories into actionable guidance.",
    argsSchema: {
      task: z.string().min(1).describe("The task you need help with. Be specific for better context matching."),
      budget: z.number().min(200).max(8000).optional().describe("Character budget for context (default 1200, max 8000)."),
      shape: z.boolean().optional().describe("Use DeepSeek AI to shape context into task-specific guidance (default false). Requires DEEPSEEK_API_KEY.")
    }
  },
  async (args) => {
    const task = String(args.task ?? "").trim();
    const budget = Number.isFinite(args.budget) ? Number(args.budget) : 1200;
    const shape = Boolean(args.shape);

    const loaded = loadStore();
    const compressed = compressDeterministic({ records: loaded.records, query: task, budget, limit: 25 });

    let contextBlock = compressed.markdown;
    let shapingNote = "";

    // If shaping is requested and DeepSeek is configured, transform the context
    if (shape) {
      const key = (process.env.DEEPSEEK_API_KEY || "").trim();
      if (key) {
        const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
        const model = (process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
        try {
          contextBlock = await deepSeekShape({ baseUrl, apiKey: key, model }, task, compressed.markdown, budget);
          shapingNote = " (AI-shaped)";
        } catch (err) {
          // Fall back to deterministic compression on error
          log(`DeepSeek shaping failed, using deterministic: ${err}`);
          shapingNote = " (shaping failed, using deterministic)";
        }
      } else {
        shapingNote = " (DeepSeek not configured)";
      }
    }

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `## Project Context${shapingNote}\n\n${contextBlock}\n\n---\n\nUsing the context above, help me with: **${task}**`
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
