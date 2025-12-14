---
title: Add Copilot Memory
description: Capture a new memory via the copilot-memory-store MCP server.
---

## Goal
Store a concise, well-tagged memory using the `copilot-memory` MCP tools so it can be retrieved later.

## When to Use
- The user says "remember", "note", "save", or otherwise asks to persist information.
- The user provides project decisions, preferences, conventions, or other facts worth recalling.

## Workflow
1. Confirm the memory text with the user. Gather optional tags (comma-separated) if they mention categories.
2. Build a short, descriptive summary if the user is vague; ask clarifying questions when needed.
3. Call the `copilot-memory/memory_write` tool with:
   ```json
   {
     "text": "exact memory text",
     "tags": ["tag-one", "tag-two"]
   }
   ```
   - Omit `tags` when none are provided.
   - Normalize tags to lowercase, dash-separated words when possible.
4. On success, acknowledge the stored memory and share the returned `id` with the user.
5. Suggest the “Retrieve Copilot Memory” prompt when they want to review stored notes.
