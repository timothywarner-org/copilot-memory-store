# CLI Guide - Copilot Memory Store

Interactive command-line interface for managing your memory store.

> **Prefer a GUI?** Use the [Memory agent in VS Code](README.md#3-use-the-memory-agent-recommended) for natural language interaction with GitHub Copilot.

## Starting the CLI

```bash
npm run dev
```

You'll see:

```text
Loaded 0 memories
Type "help" for available commands, "exit" to quit.

memory>
```

## Commands Reference

### `add` - Store a Memory

Memories are automatically indexed with extracted keywords for better search.

```bash
# Basic usage
add I prefer TypeScript over JavaScript for large projects

# With tags for organization
add --tags preference,language I prefer TypeScript over JavaScript

# Multi-word with quotes
add --tags architecture,decision "We chose PostgreSQL for ACID compliance"
```

### `search` - Find Memories

Returns prettified markdown output by default.

```bash
# Basic search
search typescript

# Limit results
search database --limit 5

# Multi-word query
search "error handling patterns"

# Raw output (compact, for scripting)
search typescript --raw
```

**Scoring:** Results ranked by keyword matches (5pts) + tag matches (8pts) + extracted keyword matches (6pts) + recency bonus (0-5pts)

### `compress` - Context Engineering

The key feature for context injection into LLMs.

```bash
# Basic compression (deterministic, no LLM needed)
compress --query "react patterns"

# With character budget
compress --query "authentication" --budget 800

# Limit memories considered
compress --query "database" --budget 1200 --limit 10

# LLM-assisted compression (requires DEEPSEEK_API_KEY)
compress --query "project decisions" --budget 1000 --llm
```

### `delete` - Soft Delete

```bash
# Delete by ID (creates tombstone, recoverable)
delete m_20241213T150000000Z_abc123
```

### `purge` - Hard Delete

```bash
# By exact ID
purge --id m_20241213T150000000Z_abc123

# By tag (deletes ALL with this tag)
purge --tag temporary

# By substring match
purge --match "test data"

# Preview what would be deleted
purge --match "test" --dry-run
```

### `export` - Dump All Data

```bash
# Outputs raw JSON (including tombstoned items)
export
```

### `stats` - View Statistics

```bash
stats
# Output:
# total=42 active=40 deleted=2
# top tags:
# - preference: 12
# - architecture: 8
# - pattern: 6
```

### `help` - Show Commands

```bash
help
```

### `exit` - Quit

```bash
exit
# or
quit
```

## Tips for Context Engineering

### 1. Use Consistent Tags

```bash
add --tags pref I like X        # Bad - inconsistent
add --tags preference I like X  # Good - consistent
```

### 2. Keep Memories Atomic

```bash
# Bad - too broad
add We use React, TypeScript, Jest, PostgreSQL, and Docker

# Good - atomic, searchable individually
add --tags stack,frontend We use React 18 with TypeScript
add --tags stack,testing Jest for unit tests
add --tags stack,database PostgreSQL as primary database
```

### 3. Include Searchable Keywords

```bash
# Bad - vague
add Don't do that thing with the stuff

# Good - searchable
add --tags antipattern,react Avoid prop drilling - use Context or Zustand
```

### 4. Budget-Aware Compression

```bash
# Small context window
compress --query "react" --budget 400

# Larger context available
compress --query "react" --budget 2000

# Let LLM prioritize what's important
compress --query "react" --budget 600 --llm
```

### 5. Recommended Tags

- `preference` - Personal coding preferences
- `pattern` - Design patterns to follow
- `antipattern` - Things to avoid
- `architecture` - System design decisions
- `decision` - ADRs and rationale
- `stack` - Technology choices
- `convention` - Team conventions
