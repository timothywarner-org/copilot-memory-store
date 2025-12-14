# Copilot Memory Store – AI Agent Instructions

## Overview
- Local JSON-backed memory store focused on Copilot context engineering; all persistence, search, and compression flow through src/memoryStore.ts.
- TypeScript project compiled to ESM (tsconfig targets ES2022); prefer async/await and `import` syntax, and avoid introducing CommonJS helpers.

## Core Modules
- src/memoryStore.ts centralizes file locking, keyword extraction, scoring, and deterministic compression—reuse these helpers instead of reimplementing I/O or search logic.
- src/mcp-server.ts exposes memory operations as MCP tools/resources/prompts; stdout is reserved for JSON-RPC, so log via stderr with the `log` helper.
- src/cli.ts provides the `memory>` REPL, reloading the store on each command to avoid state drift; keep CLI handlers thin wrappers over memoryStore APIs.
- src/deepseek.ts wraps the optional DeepSeek chat-completions endpoint; it expects OpenAI-compatible responses and trims output to the requested character budget.

## Memory File Behavior
- Memories live in `.copilot-memory.json` by default (override with MEMORY_PATH); writes must go through addMemory/softDelete/purge so the atomic lock files remain correct.
- Records include auto-extracted keywords (top 10, stop-word filtered) that power search scoring; preserve this contract when adding new ingestion paths.
- Search scoring weights keyword hits, tag matches, and recency—any new ranking tweaks should adjust scoreRecord and keep CLI/MCP outputs in sync.
- Deterministic compression builds a markdown list inside a strict character budget; respect the budget plumbing when layering new formatting.

## CLI & MCP Workflows
- CLI commands (`npm run dev`) rely on `tokenize`/`parse` helpers for flags like `--tags` or `--llm`; honor those conventions when extending commands.
- MCP server runs via `npm run mcp` (tsx) or compiled `npm run mcp:dist`; any new tool must return structured text payloads compatible with MCP SDK expectations.
- Inspector scripts (`npm run inspect`, `npm run inspect:dev`) execute the MCP server for debugging—keep transports compatible with stdio + inspector usage.

## LLM Compression
- DeepSeek integration activates only when `--llm` is requested and DEEPSEEK_API_KEY is present; fall back gracefully to deterministic compression otherwise.
- Configurable env settings come from `.env` / `.env.example`: MEMORY_PATH, optional MEMORY_LOCK_PATH, and DeepSeek base URL/model values.

## Conventions & Gotchas
- Do not cache store contents between requests in long-lived processes; always call loadStore() to pick up external changes and tombstones.
- Keep markdown outputs stable (search, compression, resources) because downstream prompts rely on their headings and bullet structure.
- Tests are not present; validate changes manually by running CLI commands or MCP inspector flows.
- For custom Copilot trigger phrases and MCP prompt usage see COPILOT_INSTRUCTIONS.md at repo root; keep new behaviors aligned with those documented triggers.
