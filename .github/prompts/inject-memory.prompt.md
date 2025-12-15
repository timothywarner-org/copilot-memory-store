---
title: Inject Memory Context
description: Auto-inject relevant memories as shaped context for a coding task.
---

## Goal
Retrieve and intelligently shape stored memories into actionable context before starting a coding task. Uses DeepSeek LLM (when configured) to transform raw memories into task-specific guidance.

## When to Use
- **Before starting any significant task** - automatically pull relevant context
- User says "with context", "use my preferences", "remember what I said about..."
- Working on code that relates to previous decisions or patterns
- User wants their stored preferences applied to the current task

## Workflow

### 1. Identify the Task
Ask the user what they need help with, or infer from the conversation. Be specific about the task scope.

### 2. Inject Shaped Context
Call the `copilot-memory/inject-context` prompt with:
```json
{
  "task": "description of what user needs",
  "budget": 1500,
  "shape": true
}
```

**Parameters:**
- `task` (required): Clear description of the coding task
- `budget` (optional): Character limit for context (default 1200, max 8000)
- `shape` (optional): Set to `true` to use DeepSeek for intelligent shaping

### 3. Apply the Context
The shaped context will include:
- Relevant decisions and constraints
- Code conventions and patterns
- User preferences that apply
- Key constraints section (if any)

Use this context to guide your response. Reference specific memories when they influence your suggestions.

## Example Usage

**User:** "Help me add error handling to the API endpoints"

**You should:**
1. Call `inject-context` with task: "add error handling to API endpoints" and shape: true
2. The shaped context might return:
   ```markdown
   ## Context for: API Error Handling

   ### Preferences
   - Use custom `AppError` class for all errors
   - Return consistent JSON error format: `{ error: string, code: number }`

   ### Key Constraints
   - Log errors to stderr, never expose stack traces
   - HTTP 4xx for client errors, 5xx for server errors
   ```
3. Apply these preferences in your error handling suggestions

## Fallback Behavior
- If DeepSeek is not configured, falls back to deterministic compression
- If no relevant memories exist, proceed normally and offer to save decisions made
- On API errors, uses raw compressed context (still useful, just not shaped)

## Tips
- Use higher budgets (2000-4000) for complex tasks with many relevant memories
- Combine with `memory_search` first if you want to preview what memories exist
- After completing a task, use `memory_write` to save any new decisions made
