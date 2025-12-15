# Quick Start Cheatsheet

Copy-paste commands for when you forget. No fluff.

## npm Commands

```bash
# ─────────────────────────────────────────────────────────────
# INSTALL & BUILD (do this first)
# ─────────────────────────────────────────────────────────────
npm install                    # Install dependencies
npm run build                  # Compile TypeScript to dist/

# ─────────────────────────────────────────────────────────────
# RUN THE CLI (interactive REPL)
# ─────────────────────────────────────────────────────────────
npm run dev                    # Start CLI with tsx (dev mode)

# Inside the CLI:
#   memory> add "My first memory" --tags learning,test
#   memory> search learning
#   memory> compress "learning" --budget 500
#   memory> stats
#   memory> help
#   memory> exit

# ─────────────────────────────────────────────────────────────
# RUN THE MCP SERVER (for Copilot/clients)
# ─────────────────────────────────────────────────────────────
npm run mcp                    # Run MCP server with tsx (dev)
npm run mcp:dist               # Run compiled version (after build)

# ─────────────────────────────────────────────────────────────
# MCP INSPECTOR (web UI for testing)
# ─────────────────────────────────────────────────────────────
npm run inspect                # Launch inspector (uses dist/)
npm run inspect:dev            # Launch with tsx live reload

# Inspector opens at: http://localhost:5173
# Click "Connect" → browse Tools, Resources, Prompts
# Execute tools and see JSON-RPC traffic

# ─────────────────────────────────────────────────────────────
# OTHER USEFUL COMMANDS
# ─────────────────────────────────────────────────────────────
npm run clean                  # Remove dist/ directory
npm run lint                   # Run ESLint
```

## Environment Setup

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your settings:
MEMORY_PATH=project-memory.json      # Where memories are stored
DEEPSEEK_API_KEY=sk-your-key         # Optional: for LLM compression
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## VS Code Setup

1. **Build first:** `npm run build`
2. **Reload VS Code:** `Ctrl+Shift+P` → "Developer: Reload Window"
3. **Open Copilot Chat:** `Ctrl+Alt+I` (or click the Copilot icon)
4. **Select Memory Agent:** Click agent dropdown → choose "Memory"

## CLI Quick Examples

```bash
# Start the CLI
npm run dev

# Then in the memory> prompt:

# Add memories
add "Always use TypeScript strict mode" --tags preference,typescript
add "We chose PostgreSQL for ACID compliance" --tags decision,database
add "API endpoints follow REST conventions" --tags pattern,api

# Search
search typescript
search "database decision"
search api --limit 5

# Compress for context injection
compress "typescript patterns" --budget 800
compress "all decisions" --budget 1500 --llm   # Uses DeepSeek

# View stats
stats

# Export all
export

# Soft delete (recoverable)
delete m_20241214T123456Z_abc123

# Hard delete
purge --tag outdated
purge --match "old pattern"
```

## MCP Inspector Quick Guide

1. Run `npm run inspect`
2. Browser opens to `http://localhost:5173`
3. Click **"Connect"** button
4. Left sidebar shows:
   - **Tools (7):** memory_write, memory_search, memory_compress, inject_context, etc.
   - **Resources (2):** memory://stats, memory://recent
   - **Prompts (3):** summarize-memories, remember-decision, inject-context
5. Click any tool → fill in parameters → click **"Execute"**
6. See JSON-RPC request/response in the traffic panel

### Test inject_context tool (recommended)

In the Inspector:

1. Click **Tools** → **inject_context**
2. Fill in:
   - `task`: "refactor the authentication module"
   - `budget`: 1500
3. Click **"Execute"**
4. See the AI-shaped context output (uses DeepSeek if configured)

### Alternative: Test inject-context prompt

In the Inspector:

1. Click **Prompts** → **inject-context**
2. Fill in:
   - `task`: "refactor the authentication module"
   - `budget`: 1500
   - `shape`: true (check the box)
3. Click **"Get Prompt"**
4. See the shaped context output

## File Locations

| File | Purpose |
|------|---------|
| `.copilot-memory.json` | Default memory storage (CLI) |
| `project-memory.json` | Demo memories for workshops |
| `.vscode/mcp.json` | MCP server config for VS Code |
| `.github/agents/memory-agent.agent.md` | Custom Copilot agent |
| `.github/prompts/*.prompt.md` | Reusable Copilot prompts |

## Troubleshooting

### MCP server not connecting?
```bash
# Rebuild and reload
npm run build
# Then in VS Code: Ctrl+Shift+P → "Developer: Reload Window"
```

### CLI not finding memories?
```bash
# Check which file it's using
echo $MEMORY_PATH              # Should show your memory file path
cat .env                        # Verify MEMORY_PATH setting
```

### DeepSeek not working?
```bash
# Verify API key is set
echo $DEEPSEEK_API_KEY         # Should show your key (or be empty)
# Test with --llm flag in CLI
npm run dev
# memory> compress "test" --llm
```

### Windows path issues?
```bash
# Use forward slashes or escape backslashes
MEMORY_PATH=c:/github/copilot-memory-store/project-memory.json
# OR
MEMORY_PATH=c:\\github\\copilot-memory-store\\project-memory.json
```
