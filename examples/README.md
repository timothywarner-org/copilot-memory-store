# Examples

Quick reference guides and seed data for workshops and learning.

## Contents

| File | Description |
|------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | npm commands cheatsheet - CLI, MCP, Inspector |
| [COPILOT_CHAT_EXAMPLES.md](COPILOT_CHAT_EXAMPLES.md) | 50+ copy-paste prompts for GitHub Copilot Chat |
| [scenarios/](scenarios/) | Pre-built memory files for different use cases |

## Scenarios

Load these into your memory store to start with realistic data:

```bash
# React/frontend developer setup
cp examples/scenarios/react-developer.json .copilot-memory.json

# API/backend developer setup
cp examples/scenarios/api-backend.json .copilot-memory.json

# Team architecture decisions (ADR-style)
cp examples/scenarios/team-decisions.json .copilot-memory.json
```

### Available Scenarios

| Scenario | Memories | Focus |
|----------|----------|-------|
| `react-developer.json` | 15 | React, TypeScript, styling, testing patterns |
| `api-backend.json` | 16 | REST API, database, auth, architecture patterns |
| `team-decisions.json` | 15 | ADRs, tech stack, team context, migrations |

## Quick Start for Workshops

### 1. First-time setup
```bash
npm install
npm run build
```

### 2. Load scenario data
```bash
cp examples/scenarios/react-developer.json project-memory.json
```

### 3. Try the CLI
```bash
npm run dev
# memory> search react
# memory> compress "react patterns" --budget 500
```

### 4. Try the MCP Inspector
```bash
npm run inspect
# Browser opens → Connect → Browse tools → Execute
```

### 5. Try Copilot Chat
1. Reload VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")
2. Open Copilot Chat (`Ctrl+Alt+I`)
3. Select **Memory** agent
4. Try: "What React patterns do I have stored?"

## Workshop Flow

### 30-minute intro

1. **5 min** - Explain context engineering concept
2. **10 min** - Demo CLI: add, search, compress
3. **10 min** - Demo MCP Inspector: browse tools, execute
4. **5 min** - Demo Copilot Chat with Memory agent

### 60-minute deep dive

1. **10 min** - Context engineering + MCP overview
2. **15 min** - Hands-on CLI exercises
3. **15 min** - MCP Inspector exploration
4. **15 min** - Copilot Chat integration
5. **5 min** - Q&A

### Exercises

See [COPILOT_CHAT_EXAMPLES.md](COPILOT_CHAT_EXAMPLES.md) for:
- Storing memories (preferences, decisions, patterns)
- Searching and recalling
- Using inject-context for tasks
- Memory management
- Power user patterns
