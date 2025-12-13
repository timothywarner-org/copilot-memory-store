/**
 * @fileoverview DeepSeek LLM integration for intelligent context compression.
 *
 * Provides optional LLM-assisted compression using the DeepSeek API
 * (OpenAI-compatible). When enabled, the LLM intelligently summarizes
 * and prioritizes memory context based on the user's query.
 *
 * ## Configuration
 * Set these environment variables to enable LLM compression:
 * - `DEEPSEEK_API_KEY` (required) - Your DeepSeek API key
 * - `DEEPSEEK_BASE_URL` (optional) - API endpoint (default: https://api.deepseek.com)
 * - `DEEPSEEK_MODEL` (optional) - Model to use (default: deepseek-chat)
 *
 * ## Usage
 * LLM compression is triggered by:
 * - CLI: `compress --query "topic" --llm`
 * - MCP: `memory_compress` with `llm: true`
 *
 * If DEEPSEEK_API_KEY is not set, falls back to deterministic compression.
 *
 * @module deepseek
 */

/**
 * Configuration for DeepSeek API client.
 *
 * @property baseUrl - API endpoint URL (e.g., "https://api.deepseek.com")
 * @property apiKey - Authentication token for the API
 * @property model - Model identifier (e.g., "deepseek-chat")
 */
export type DeepSeekConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/**
 * Compresses memory context using DeepSeek LLM.
 *
 * Sends the pre-filtered markdown context to DeepSeek with instructions
 * to compress it intelligently based on the user's query. The LLM
 * prioritizes relevant information and removes redundancy.
 *
 * @param cfg - DeepSeek API configuration
 * @param query - User's search query (used for relevance prioritization)
 * @param markdownContext - Pre-filtered markdown from deterministic compression
 * @param budgetChars - Maximum character limit for output
 * @returns Compressed markdown string within budget
 * @throws Error if API request fails or response is malformed
 *
 * @example
 * ```typescript
 * const compressed = await deepSeekCompress(
 *   { baseUrl: "https://api.deepseek.com", apiKey: "sk-...", model: "deepseek-chat" },
 *   "react patterns",
 *   "# Context\n- Use hooks for state\n- Prefer composition...",
 *   800
 * );
 * ```
 */
export async function deepSeekCompress(cfg: DeepSeekConfig, query: string, markdownContext: string, budgetChars: number): Promise<string> {
  const url = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";

  const system = [
    "You compress user memory context for an LLM coding assistant.",
    "Output must be Markdown.",
    "Be concise.",
    "Keep only information relevant to the user's query.",
    `Hard limit: ${budgetChars} characters.`,
    "Do not include any secrets."
  ].join(" ");

  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Query:\n${query}\n\nContext:\n${markdownContext}` }
    ],
    temperature: 0.2
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${text}`);
  }

  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("DeepSeek response missing content.");
  return content.length > budgetChars ? content.slice(0, budgetChars) : content;
}
