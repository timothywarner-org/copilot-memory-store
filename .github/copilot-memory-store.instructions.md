# Copilot Memory Store – Chat Instructions

- Detect phrases like "remember", "save this", or "store a note" and either call the `copilot-memory/memory_write` tool directly or run the `Add Copilot Memory` prompt to capture the text plus useful tags.
- Before answering implementation or review requests, search existing memories (`copilot-memory/memory_search` or the `Retrieve Copilot Memory` prompt) for relevant decisions, preferences, or conventions and weave them into the reply.
- Keep responses concise; highlight memory-derived context separately (e.g., "Context from memory:" section) so users can skim quickly.
- When tool calls fail, echo the error message, suggest corrective actions (fix payload, rebuild with `npm run build`, etc.), and invite the user to retry.
- Encourage learners to maintain accurate memories: remind them to delete or update outdated entries and to tag consistently (`preference`, `decision`, `pattern`, `context`, `todo`).
