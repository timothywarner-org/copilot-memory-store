# CLI Guide - Copilot Memory Store

Interactive command-line interface for managing your memory store.

## Starting the CLI

```bash
npm run dev
```

You'll see:

```
📦 Loaded 0 memories
Type "help" for available commands, "exit" to quit.

memory>
```

---

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

**Output format:**

```markdown
## Memory Search: "typescript"
Found 2 relevant memories:

### 1. I prefer TypeScript over JavaScript
Tags: preference, language | Keywords: typescript, javascript | Relevance: high (21.0) | ID: `m_xxx`

### 2. Always use strict TypeScript mode
Keywords: strict, typescript, mode | Relevance: medium (15.0) | ID: `m_xxx`
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

**Output:** Markdown block ready for LLM context injection:

```markdown
# Copilot Context (auto)

## Relevant memory
- (m_20241213...) [architecture] We use microservices for scalability
- (m_20241212...) [database] PostgreSQL for ACID, Redis for caching
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

---

## Sample Session

Here's a complete workflow demonstrating all features:

```bash
# Start the CLI
npm run dev

# Add some memories
memory> add --tags preference,style I prefer functional programming patterns
✅ Added m_20241213T160000000Z_a1b2c3

memory> add --tags typescript,pattern Always use strict TypeScript with no-any rule
✅ Added m_20241213T160001000Z_d4e5f6

memory> add --tags react,hooks Custom hooks should be prefixed with "use"
✅ Added m_20241213T160002000Z_g7h8i9

memory> add --tags architecture We use a modular monolith, not microservices
✅ Added m_20241213T160003000Z_j0k1l2

memory> add --tags testing Jest for unit tests, Playwright for E2E
✅ Added m_20241213T160004000Z_m3n4o5

# Check stats
memory> stats
total=5 active=5 deleted=0
top tags:
- preference: 1
- typescript: 1
- react: 1
- architecture: 1
- testing: 1

# Search for specific topics (prettified output)
memory> search typescript
## Memory Search: "typescript"
Found 1 relevant memory:

### 1. Always use strict TypeScript with no-any rule
Tags: typescript, pattern | Keywords: strict, typescript, rule | Relevance: high (21.0) | ID: `m_xxx`

# Search with raw output
memory> search patterns --limit 3 --raw
- m_20241213T160000000Z_a1b2c3 [preference, style] (score 8.0) I prefer functional programming patterns
- m_20241213T160001000Z_d4e5f6 [typescript, pattern] (score 5.0) Always use strict TypeScript with no-any rule

# Compress for context injection
memory> compress --query "coding standards" --budget 500
# Copilot Context (auto)

## Relevant memory
- (m_20241213T160001000Z_d4e5f6) [typescript, pattern] Always use strict TypeScript with no-any rule
- (m_20241213T160000000Z_a1b2c3) [preference, style] I prefer functional programming patterns

# Soft delete a memory
memory> delete m_20241213T160004000Z_m3n4o5
🗑️  Soft-deleted m_20241213T160004000Z_m3n4o5

# Check stats again
memory> stats
total=5 active=4 deleted=1

# Hard delete with dry run first
memory> purge --tag testing --dry-run
🔎 Dry run: would purge 1 memories:
- m_20241213T160004000Z_m3n4o5

# Export everything
memory> export
[
  {
    "id": "m_20241213T160000000Z_a1b2c3",
    "text": "I prefer functional programming patterns",
    "tags": ["preference", "style"],
    "keywords": ["functional", "programming", "patterns"],
    ...
  },
  ...
]

# Exit
memory> exit
```

---

## Tips for Context Engineering

### 1. Use Consistent Tags

```bash
add --tags pref I like X        # ❌ Inconsistent
add --tags preference I like X  # ✅ Consistent
```

### 2. Keep Memories Atomic

```bash
# ❌ Too broad
add We use React, TypeScript, Jest, PostgreSQL, and Docker

# ✅ Atomic - searchable individually
add --tags stack,frontend We use React 18 with TypeScript
add --tags stack,testing Jest for unit tests
add --tags stack,database PostgreSQL as primary database
add --tags stack,devops Docker for containerization
```

### 3. Include Searchable Keywords

```bash
# ❌ Vague
add Don't do that thing with the stuff

# ✅ Searchable
add --tags antipattern,react Avoid prop drilling - use Context or Zustand instead
```

### 4. Budget-Aware Compression

```bash
# Small context window (e.g., for prompts with lots of code)
compress --query "react" --budget 400

# Larger context available
compress --query "react" --budget 2000

# Let LLM prioritize what's important
compress --query "react" --budget 600 --llm
```

### 5. Use Tags for Categories

Good tag categories:

- `preference` - Personal coding preferences
- `pattern` - Design patterns to follow
- `antipattern` - Things to avoid
- `architecture` - System design decisions
- `decision` - ADRs and rationale
- `stack` - Technology choices
- `convention` - Team conventions
