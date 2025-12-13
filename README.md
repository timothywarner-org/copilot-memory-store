# Copilot Memory Store

A **local JSON memory store** for context engineering with GitHub Copilot and MCP clients.

## Features

- **CLI** (`memory>`) - Interactive REPL for managing memories
- **MCP Server** - Stdio server exposing tools, resources, and prompts for GitHub Copilot (Agent mode) or any MCP client
- **Context Compression** - Budget-constrained context injection with optional LLM summarization
- **Auto-Keywords** - Automatic keyword extraction for improved search relevance

## Why This Exists

LLMs have limited context windows. This tool helps you:

1. **Store** important information as searchable memories with auto-extracted keywords
2. **Search** memories by relevance scoring (keywords + tags + recency)
3. **Compress** relevant memories into a character budget for context injection

Perfect for teaching **context engineering** - the art of fitting the right information into limited LLM context.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Build the project
npm run build

# Run the CLI
npm run dev

# Or run the MCP server
npm run mcp
```

## Configuration

Edit `.env`:

```env
# Required: where memories are stored
MEMORY_PATH=.copilot-memory.json

# Optional: for LLM-assisted compression
DEEPSEEK_API_KEY=your-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## MCP Server Features

### Tools

| Tool | Description |
|------|-------------|
| `memory_write` | Add a memory with optional tags (auto-extracts keywords) |
| `memory_search` | Search memories with prettified markdown output |
| `memory_compress` | Compress relevant memories into budget-constrained markdown |
| `memory_delete` | Soft-delete a memory (tombstone) |
| `memory_purge` | Hard-delete by id, tag, or substring match |
| `memory_export` | Export all records as JSON |

### Resources

| Resource | URI | Description |
|----------|-----|-------------|
| `stats` | `memory://stats` | Live statistics (counts, top tags) |
| `recent` | `memory://recent` | Last 10 memories added |

### Prompts

| Prompt | Description |
|--------|-------------|
| `summarize-memories` | Generate a summary of memories on a topic |
| `remember-decision` | Structured template for architectural decisions |
| `inject-context` | Auto-inject relevant memories as context for a task |

## GitHub Copilot Integration

### 1. Build the project

```bash
npm run build
```

### 2. Create `.vscode/mcp.json`

```json
{
  "servers": {
    "copilot-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp-server.js"],
      "env": {
        "MEMORY_PATH": ".copilot-memory.json"
      }
    }
  }
}
```

### 3. Enable in Copilot

Open Copilot Chat → Agent mode → Enable `copilot-memory` tools.

## MCP Inspector

Debug and test the MCP server interactively:

```bash
# Launch inspector (opens web UI)
npm run inspect

# Or with live TypeScript reloading
npm run inspect:dev
```

The inspector lets you:

- Browse all tools, resources, and prompts
- Execute tools and see responses
- View raw JSON-RPC message traffic

## CLI Commands

See [CLI_GUIDE.md](CLI_GUIDE.md) for detailed usage and examples.

| Command | Description |
|---------|-------------|
| `add [--tags a,b] <text>` | Add a memory |
| `search <query> [--limit N] [--raw]` | Search memories |
| `compress <query> [--budget N] [--llm]` | Compress for context |
| `delete <id>` | Soft-delete |
| `purge --id/--tag/--match` | Hard-delete |
| `export` | Dump JSON |
| `stats` | Show statistics |

## Context Engineering Demo

The `memory_compress` tool demonstrates key context engineering concepts:

1. **Relevance Scoring** - Memories ranked by keyword matches + tag matches + recency
2. **Budget Constraints** - Fit context into character limits (200-8000 chars)
3. **Deterministic Compression** - Predictable truncation without LLM
4. **LLM-Assisted Compression** - Optional DeepSeek summarization for smarter compression

## Architecture

```
src/
├── cli.ts          # Interactive REPL
├── mcp-server.ts   # MCP stdio server (tools, resources, prompts)
├── memoryStore.ts  # Core storage, search, compression
└── deepseek.ts     # Optional LLM compression
```

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run CLI with tsx (dev mode) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run mcp` | Run MCP server with tsx |
| `npm run inspect` | Launch MCP Inspector |
| `npm run inspect:dev` | Inspector with tsx (live reload) |

## External Resources

- [VS Code MCP Servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [MCP Specification](https://modelcontextprotocol.io/specification/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

## License

MIT
