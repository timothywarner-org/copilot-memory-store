# Copilot Memory Store - Usage Guide

This guide explains how to use the memory tools effectively with GitHub Copilot in VS Code.

## Quick Start: Use the Memory Agent

The easiest way to use memory tools is with the pre-configured **Memory agent**:

1. Open Copilot Chat in VS Code
2. Click the agent dropdown (top of chat panel)
3. Select **"Memory"**
4. Chat naturally!

The Memory agent automatically:

- Saves preferences, decisions, and context when you mention them
- Searches memory before starting tasks
- Uses meaningful tags for organization

## Natural Language Examples

With the Memory agent selected, just talk naturally:

### Saving Memories

```text
"Remember that I prefer functional components over class components"
"Save a note that we're using PostgreSQL for the database"
"Store this decision: we chose JWT for authentication"
"Note that our API uses kebab-case for endpoints"
```

### Searching Memories

```text
"What preferences do I have saved?"
"Find my notes about the database"
"What did we decide about authentication?"
"Show me everything about React patterns"
```

### Using Memory for Context

```text
"Help me refactor auth.ts" → Agent searches memory first
"Review this PR" → Agent checks for relevant coding standards
"What testing approach should I use?" → Agent recalls your preferences
```

## Direct Tool References

You can also reference tools directly with `#` prefix:

```text
#memory_write text: "We use Tailwind CSS" tags: ["stack", "styling"]
#memory_search query: "styling"
#memory_compress query: "architecture" budget: 1000
```

## Available Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `memory_write` | Store information | "remember", "save", "store", "note" |
| `memory_search` | Find information | "what", "find", "recall", "show" |
| `memory_compress` | Get compact context | Need context for complex tasks |
| `memory_delete` | Soft-delete | "forget", "remove" |
| `memory_purge` | Permanently delete | Clean up old/wrong memories |
| `memory_export` | Export all data | Backup or review all memories |

## Recommended Tags

Use consistent tags for better organization:

| Tag | Use For |
|-----|---------|
| `preference` | Coding style preferences |
| `decision` | Architectural decisions |
| `pattern` | Design patterns to follow |
| `antipattern` | Things to avoid |
| `stack` | Technology choices |
| `convention` | Team/project conventions |
| `context` | Project-specific information |
| `todo` | Things to remember for later |

## MCP Resources (Read-Only)

The server also exposes resources that provide live data:

| Resource | URI | Description |
|----------|-----|-------------|
| Stats | `memory://stats` | Memory counts and top tags |
| Recent | `memory://recent` | Last 10 memories added |

## MCP Prompts

> **Note:** VS Code GitHub Copilot does not currently support MCP prompts. These work with the MCP Inspector and other MCP clients.

| Prompt | Description |
|--------|-------------|
| `summarize-memories` | Summarize memories on a topic |
| `remember-decision` | Template for architectural decisions (ADR format) |
| `inject-context` | Auto-inject relevant context for a task |

## Tips for Effective Memory Use

### 1. Be Specific

```text
Bad:  "Remember that thing about the database"
Good: "Remember that we use PostgreSQL with Prisma ORM"
```

### 2. Use Tags Consistently

```text
Bad:  "Remember [pref] I like tabs"
Good: "Remember that I prefer tabs over spaces" (agent adds tags)
```

### 3. Keep Memories Atomic

```text
Bad:  "Remember we use React, TypeScript, Jest, and PostgreSQL"
Good:
  "Remember we use React 18 for the frontend"
  "Remember we use TypeScript in strict mode"
  "Remember we use Jest for unit testing"
```

### 4. Clean Up Outdated Info

When decisions change:

```text
"Forget the old database decision"
"Remember that we switched from MySQL to PostgreSQL"
```

### 5. Search Before Starting Tasks

The Memory agent does this automatically, but you can be explicit:

```text
"Check my memories about auth patterns, then help me implement login"
```

## Troubleshooting

### Tools Not Working?

1. **Build the project:** `npm run build`
2. **Reload VS Code:** `Ctrl+Shift+P` → "Developer: Reload Window"
3. **Check agent is selected:** Make sure "Memory" agent is active

### Natural Language Not Triggering Tools?

- Make sure you're using the **Memory** agent (not Ask or default Agent)
- Try being more explicit: "Search my memories for X"
- Fall back to direct tool reference: `#memory_search query: "X"`

### MCP Server Not Connecting?

Check `.vscode/mcp.json` exists and points to the built server:

```json
{
  "servers": {
    "copilot-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["./dist/mcp-server.js"],
      "env": {
        "MEMORY_PATH": "project-memory.json"
      }
    }
  }
}
```
