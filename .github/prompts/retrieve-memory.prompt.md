---
title: Retrieve Copilot Memory
description: Find stored memories via the copilot-memory-store MCP server.
---

## Goal
Help the user recall previously saved information by querying the memory store with meaningful filters.

## When to Use
- The user asks "what did we decide…", "do I have a note about…", or requests project context.
- Before starting a task where existing preferences or decisions might apply.

## Workflow
1. Ask which keywords, tags, or recent topics should guide the search. Encourage specificity.
2. If they only want a single result, confirm a limit (default to 5 otherwise).
3. Call the `copilot-memory/memory_search` tool with:
   ```json
   {
     "query": "search terms",
     "limit": 5,
     "raw": false
   }
   ```
   - Adjust `limit` (1-50) to match the user’s request.
   - Set `raw` to `true` only when they explicitly want JSON output.
4. Summarize the hits, including IDs, tags, and the memory text. Highlight the most relevant items first.
5. Offer follow-up actions: refine the search, compress the results (`memory_compress`), or add new memories using the companion prompt.
