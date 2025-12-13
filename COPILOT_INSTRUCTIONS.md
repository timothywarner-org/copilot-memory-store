# Copilot Memory Store - Custom Instructions

Add these triggers to your GitHub Copilot custom instructions to enable memory features.

## Trigger Phrases

Use these deterministic triggers in your prompts:

| Trigger | Action |
|---------|--------|
| `remember: <text>` | Call `memory_write` to store the text |
| `recall: <query>` | Call `memory_search` and use results to answer |
| `inject: <query>` | Call `memory_compress` and include the markdown context |

## Example Custom Instructions

Copy this to your Copilot custom instructions:

```
## Memory Tools

When the user's message contains these triggers, use the copilot-memory MCP tools:

- "remember:" → Call memory_write with the text after the trigger
- "recall:" → Call memory_search with the query, then answer using the results
- "inject:" → Call memory_compress with the query, then include the markdown in your response

### Examples

User: "remember: I prefer functional programming over OOP"
→ Call memory_write(text: "I prefer functional programming over OOP")

User: "recall: what are my coding preferences?"
→ Call memory_search(query: "coding preferences"), then summarize the hits

User: "inject: typescript patterns" then help me refactor this code
→ Call memory_compress(query: "typescript patterns", budget: 1200), include the context, then help with the refactor

Do not call memory tools unless the user uses these triggers or explicitly asks.
```

## MCP Resources

The server exposes resources that clients can fetch for context:

| Resource | URI | Description |
|----------|-----|-------------|
| Stats | `memory://stats` | Memory counts and top tags |
| Recent | `memory://recent` | Last 10 memories added |

## MCP Prompts

Pre-built prompt templates available:

| Prompt | Args | Description |
|--------|------|-------------|
| `summarize-memories` | `topic` | Summarize memories on a topic |
| `remember-decision` | `title`, `context`, `decision`, `consequences?` | Capture architectural decisions |
| `inject-context` | `task`, `budget?` | Auto-inject relevant context for a task |

## Advanced Usage

### Tag-based Organization

```
remember: [tags: react, patterns] Always use custom hooks for shared state logic
```

### Budget Control for Context Injection

```
inject: (budget: 800) authentication flow
```

### LLM-Assisted Compression

When you have many memories and need smarter summarization:

```
inject: (llm: true) project architecture decisions
```

### Raw JSON Output

For programmatic use, request raw JSON instead of formatted markdown:

```
recall: (raw: true) database schemas
```

## Best Practices

1. **Be specific with tags** - Use consistent tags like `preference`, `pattern`, `decision`, `architecture`
2. **Keep memories atomic** - One concept per memory for better search relevance
3. **Use descriptive text** - Include keywords that you'll search for later
4. **Purge outdated info** - Remove memories that are no longer accurate
5. **Use prompts for structure** - The `remember-decision` prompt ensures consistent ADR format
