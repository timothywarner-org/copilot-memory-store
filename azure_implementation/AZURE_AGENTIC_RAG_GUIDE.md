# Building an AI That Remembers: Azure Edition

> Give your AI a brain that persists between conversations

---

## What Are We Actually Building?

Picture this: You chat with an AI today, tell it you prefer dark mode and hate meetings before 10am. Tomorrow, you come back—and it remembers. No "As an AI, I don't have memory of previous conversations." It just *knows* you.

That's what this guide builds: **an AI agent with persistent memory**.

```text
You: "Schedule my dentist appointment"
AI: "I'll book it for 2pm—I know you don't do mornings.
     Want me to add it to your Google Calendar like last time?"
```

### The Three Big Ideas

1. **Memory that sticks around** — Conversations get stored and retrieved
2. **Tools the AI can use** — It can search, save, look things up
3. **Events that trigger actions** — "When X happens, do Y" (even when you're not chatting)

---

## The Architecture (Plain English Version)

Think of it like a restaurant:

```text
┌─────────────────────────────────────────────────────────────┐
│  🧑 CUSTOMER (You)                                          │
│     "I'd like the usual"                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  🚪 HOST STAND (App Gateway + API Management)               │
│     - Checks your reservation (authentication)              │
│     - Makes sure you're not banned (rate limiting)          │
│     - Seats you appropriately (routing)                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  👨‍🍳 CHEF (Container App + Semantic Kernel)                  │
│     - Checks your order history: "Ah, the usual—no onions"  │
│     - Looks up recipes if needed (knowledge base)           │
│     - Cooks your meal (calls the AI model)                  │
│     - Notes any new preferences for next time               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  📒 CUSTOMER NOTEBOOK (Cosmos DB)                           │
│     - "Table 5 hates onions"                                │
│     - "Always sits by the window"                           │
│     - "Last visited: Tuesday"                               │
└─────────────────────────────────────────────────────────────┘
```

### The Actual Azure Services

| What It Does | Azure Service | Restaurant Analogy |
|--------------|---------------|-------------------|
| Front door security | **App Gateway** | Bouncer |
| Check credentials, limit requests | **API Management** | Host stand |
| Run your AI logic | **Container Apps** | Kitchen |
| Background tasks | **Azure Functions** | Prep cooks |
| Store memories | **Cosmos DB** | Customer notebook |
| The actual AI brain | **Azure OpenAI** | The chef's skill |
| Search knowledge | **AI Search** | Recipe book |

---

## Part 1: Memory — The Secret Sauce

### What Makes AI Memory Work?

Your AI needs to store two things:

1. **What was said** (conversation history)
2. **What it means** (semantic memories)

**Conversation history** is easy—just save the chat log:

```text
User: "I'm allergic to shellfish"
AI: "Got it, I'll remember that"
```

**Semantic memory** is the interesting part. Instead of storing raw text, we store the *meaning* as numbers (called "embeddings"):

```text
"I hate meetings before 10am"
    ↓ (embedding magic)
[0.12, -0.45, 0.78, 0.33, ...]  ← 1,536 numbers that capture the meaning
```

Why numbers? Because we can search by meaning, not just keywords:

```text
Search: "What time does this person like to start work?"
Finds: "I hate meetings before 10am" ← No keyword match, but meaning matches!
```

### Two Databases, Two Jobs

```text
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  📜 HISTORY                     │  │  🧠 MEMORIES                     │
│  (What was said)                │  │  (What it means)                │
├─────────────────────────────────┤  ├─────────────────────────────────┤
│  • Raw chat transcripts         │  │  • "Prefers dark mode"          │
│  • Who said what, when          │  │  • "Allergic to shellfish"      │
│  • Auto-deletes after 30 days   │  │  • "Works at Acme Corp"         │
│  • Good for: "What did we       │  │  • Good for: "What do I know    │
│    talk about yesterday?"       │  │    about this person?"          │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### Memory Types (Keep It Simple)

Categorize memories so you can filter them:

| Type | Example | When to Use |
|------|---------|-------------|
| **fact** | "Works at Acme Corp" | Background info |
| **preference** | "Prefers dark mode" | Personalization |
| **decision** | "Chose React over Vue" | Past choices |
| **emotional** | "Stressed about deadline" | Tone/empathy |

### The Memory Schema (Code Version)

```typescript
// This is what a memory looks like in the database
interface Memory {
  id: string;
  userId: string;           // Whose memory is this?

  type: "fact" | "preference" | "decision" | "emotional";
  content: string;          // Human-readable: "Prefers dark mode"
  embedding: number[];      // Machine-searchable: [0.12, -0.45, ...]

  confidence: number;       // How sure are we? 0.0 to 1.0

  createdAt: Date;
  lastUsed: Date;           // For decay: old unused memories fade
}
```

---

## Part 2: The Orchestrator — Your AI's Traffic Controller

### What's Semantic Kernel?

It's Microsoft's toolkit for building AI apps. Think of it as the glue between:

- Your code
- The AI model (GPT-4)
- Your tools (memory, search, etc.)

Without Semantic Kernel:

```typescript
// You have to do everything manually 😫
const embedding = await openai.embeddings.create({...});
const memories = await cosmos.query({...});
const prompt = `Given these memories: ${memories}...`;
const response = await openai.chat.completions.create({...});
await cosmos.upsert({...});
```

With Semantic Kernel:

```typescript
// It handles the plumbing 😌
const response = await kernel.invoke("chat", {
  message: userMessage,
  plugins: ["memory", "search"]
});
```

### The Flow (Step by Step)

When a user sends a message, here's what happens:

```text
1. USER SAYS: "Book my usual lunch spot for Friday"
                    ↓
2. SEARCH MEMORIES: "What's their usual lunch spot?"
   Found: "Prefers Olive Garden, always gets breadsticks"
                    ↓
3. BUILD PROMPT:
   "The user wants to book lunch. You know they like
    Olive Garden and always get breadsticks. Help them."
                    ↓
4. CALL GPT-4: Generate response
                    ↓
5. RESPOND: "I'll book Olive Garden for Friday.
             Want me to request extra breadsticks?"
                    ↓
6. SAVE NEW MEMORY: "Has lunch planned for Friday at Olive Garden"
```

### Basic Orchestrator Code

```typescript
async function handleMessage(userId: string, message: string) {

  // Step 1: What do we know about this person?
  const memories = await searchMemories(userId, message);

  // Step 2: Build context for the AI
  const context = memories
    .map(m => `- ${m.content}`)
    .join('\n');

  // Step 3: Ask GPT-4
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You're a helpful assistant.
                  Here's what you know about this user:\n${context}`
      },
      { role: "user", content: message }
    ]
  });

  // Step 4: Save any new memories (async, don't block the response)
  extractAndSaveMemories(userId, message, response); // fire and forget

  return response.choices[0].message.content;
}
```

---

## Part 3: MCP — Giving Your AI Superpowers

### What's MCP?

**Model Context Protocol** is a standard way to give AI models tools. Instead of every AI company inventing their own way to "let the AI search the web" or "let the AI read files," MCP provides one universal format.

Think of it like USB—before USB, every device had its own weird connector. MCP is USB for AI tools.

### Before and After

**Without MCP:**

```text
OpenAI function calling: { "name": "search", "parameters": {...} }
Anthropic tool use: { "tool": "search", "input": {...} }
Google function calling: { "functionCall": {...} }
😵 Every AI is different!
```

**With MCP:**

```text
MCP tool: { "name": "search", "arguments": {...} }
✅ One format, works everywhere
```

### Azure MCP Server

Microsoft provides an [MCP server](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/overview) that lets AI access Azure resources:

```typescript
// Your AI can now do this:
"List my Azure storage accounts"     → storage_list tool
"Query my Cosmos database"           → cosmos_query tool
"Get secret from Key Vault"          → keyvault_get tool
```

### Building Your Own Memory Tools

Here's how to create MCP tools for your memory system:

```typescript
// Define what tools are available
const memoryTools = {

  memory_search: {
    description: "Find relevant memories about the user",
    parameters: {
      query: "What to search for",
      limit: "Max results (default 10)"
    },

    // What happens when the AI calls this tool
    execute: async ({ query, limit = 10 }, { userId }) => {
      const memories = await searchMemories(userId, query, limit);
      return memories.map(m => m.content).join('\n');
    }
  },

  memory_save: {
    description: "Remember something about the user",
    parameters: {
      content: "What to remember",
      type: "fact, preference, decision, or emotional"
    },

    execute: async ({ content, type }, { userId }) => {
      await saveMemory(userId, content, type);
      return "Got it, I'll remember that.";
    }
  }
};
```

Now your AI can decide on its own when to search or save memories!

---

## Part 4: Events — Making It Proactive

### Why Events?

So far, everything happens when the user sends a message. But what if you want:

- **Nightly cleanup**: Merge duplicate memories, delete old ones
- **Async processing**: Extract memories from long conversations without slowing down responses
- **Triggers**: "When a new document is uploaded, summarize it"

That's where events come in.

### The Event Pattern

```text
┌────────────┐         ┌──────────────┐         ┌────────────────┐
│  SOMETHING │  ───►   │  EVENT GRID  │  ───►   │ FUNCTION RUNS  │
│  HAPPENS   │         │  (messenger) │         │ (does the work)│
└────────────┘         └──────────────┘         └────────────────┘

Examples:
• User sends message     →  "NewMessage" event    →  Extract memories
• Clock hits midnight    →  "Timer" event         →  Cleanup old data
• File uploaded          →  "BlobCreated" event   →  Process document
```

### Example: Background Memory Extraction

Instead of extracting memories during the chat (which slows things down), do it in the background:

```typescript
// In your chat handler - just fire the event and move on
async function handleMessage(userId: string, message: string, response: string) {

  // ... return response to user immediately ...

  // Fire event for background processing (non-blocking)
  await eventGrid.send({
    type: "ConversationCompleted",
    data: { userId, message, response }
  });
}

// Separate Function App picks up the event
async function extractMemoriesHandler(event) {
  const { userId, message, response } = event.data;

  // Use GPT-4 to extract memories (takes a few seconds, but user doesn't wait)
  const memories = await gpt4.extract(`
    Extract any facts, preferences, or decisions from this conversation:
    User: ${message}
    Assistant: ${response}
  `);

  // Save them
  for (const memory of memories) {
    await saveMemory(userId, memory.content, memory.type);
  }
}
```

### Scheduled Jobs

Run cleanup tasks on a schedule:

```typescript
// Runs every night at 2 AM
async function nightlyCleanup() {

  // 1. Find and merge duplicate memories
  const duplicates = await findSimilarMemories(threshold: 0.95);
  for (const group of duplicates) {
    await mergeMemories(group);
  }

  // 2. Fade old unused memories
  await applyDecay();

  // 3. Delete memories below confidence threshold
  await deleteWhere({ confidence: { lt: 0.2 } });

  console.log("Cleanup complete!");
}
```

---

## Part 5: Putting It All Together

### The Complete Flow

```text
USER: "What's that Italian place I liked?"

    ┌─────────────────────────────────────────────────────────────┐
    │ 1. REQUEST ARRIVES                                          │
    │    App Gateway → API Management → Container App             │
    └─────────────────────────────────────────────────────────────┘
                                ↓
    ┌─────────────────────────────────────────────────────────────┐
    │ 2. SEARCH MEMORIES                                          │
    │    Query: "Italian place liked"                             │
    │    Found: "Loves Olive Garden, especially the breadsticks"  │
    └─────────────────────────────────────────────────────────────┘
                                ↓
    ┌─────────────────────────────────────────────────────────────┐
    │ 3. BUILD PROMPT                                             │
    │    System: "User previously said they love Olive Garden..." │
    │    User: "What's that Italian place I liked?"               │
    └─────────────────────────────────────────────────────────────┘
                                ↓
    ┌─────────────────────────────────────────────────────────────┐
    │ 4. GPT-4 RESPONDS                                           │
    │    "You mentioned Olive Garden! Want me to find the nearest │
    │     one or make a reservation?"                             │
    └─────────────────────────────────────────────────────────────┘
                                ↓
    ┌─────────────────────────────────────────────────────────────┐
    │ 5. ASYNC: EMIT EVENT                                        │
    │    → Background function extracts new memories              │
    │    → User doesn't wait for this                             │
    └─────────────────────────────────────────────────────────────┘

USER: "You mentioned Olive Garden! Want me to find..."
```

### Minimal Working Example

Here's the simplest version that actually works:

```typescript
// 1. Setup
import { CosmosClient } from "@azure/cosmos";
import OpenAI from "openai";

const cosmos = new CosmosClient(process.env.COSMOS_CONNECTION);
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: process.env.AZURE_OPENAI_ENDPOINT
});

const memories = cosmos.database("agent").container("memories");

// 2. Search memories by meaning
async function searchMemories(userId: string, query: string) {
  // Turn the query into numbers
  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query
  });

  // Find similar memories in Cosmos DB
  const { resources } = await memories.items.query({
    query: `
      SELECT TOP 5 c.content, c.type
      FROM c
      WHERE c.userId = @userId
      ORDER BY VectorDistance(c.embedding, @embedding)
    `,
    parameters: [
      { name: "@userId", value: userId },
      { name: "@embedding", value: embedding.data[0].embedding }
    ]
  }).fetchAll();

  return resources;
}

// 3. Save a new memory
async function saveMemory(userId: string, content: string, type: string) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: content
  });

  await memories.items.create({
    id: crypto.randomUUID(),
    userId,
    content,
    type,
    embedding: embedding.data[0].embedding,
    confidence: 0.8,
    createdAt: new Date().toISOString()
  });
}

// 4. The main chat handler
async function chat(userId: string, message: string) {
  // Get relevant memories
  const context = await searchMemories(userId, message);
  const memoryText = context.map(m => `- ${m.content}`).join('\n');

  // Call GPT-4 with memory context
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You're a helpful assistant with memory.
                  What you know about this user:\n${memoryText || "Nothing yet."}`
      },
      { role: "user", content: message }
    ]
  });

  return response.choices[0].message.content;
}
```

---

## Getting Started (The Quick Path)

### Prerequisites

- Azure subscription
- Azure CLI installed
- Node.js 18+

### Step 1: Create the Resources

```bash
# Create a resource group
az group create --name my-ai-agent --location eastus

# Create Cosmos DB with vector search
az cosmosdb create \
  --name my-agent-memory \
  --resource-group my-ai-agent \
  --capabilities EnableServerless EnableNoSQLVectorSearch

# Create Azure OpenAI
az cognitiveservices account create \
  --name my-agent-openai \
  --resource-group my-ai-agent \
  --kind OpenAI \
  --sku S0 \
  --location eastus
```

### Step 2: Deploy the Models

```bash
# Deploy GPT-4o
az cognitiveservices account deployment create \
  --name my-agent-openai \
  --resource-group my-ai-agent \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-format OpenAI \
  --sku-name GlobalStandard \
  --sku-capacity 10

# Deploy embeddings model
az cognitiveservices account deployment create \
  --name my-agent-openai \
  --resource-group my-ai-agent \
  --deployment-name embeddings \
  --model-name text-embedding-ada-002 \
  --model-format OpenAI \
  --sku-name Standard \
  --sku-capacity 10
```

### Step 3: Set Up the Database

```bash
# Create database and containers
az cosmosdb sql database create \
  --account-name my-agent-memory \
  --resource-group my-ai-agent \
  --name agentdb

az cosmosdb sql container create \
  --account-name my-agent-memory \
  --resource-group my-ai-agent \
  --database-name agentdb \
  --name memories \
  --partition-key-path /userId
```

### Step 4: Run It

```bash
# Get your connection strings
export COSMOS_CONNECTION=$(az cosmosdb keys list ...)
export AZURE_OPENAI_KEY=$(az cognitiveservices account keys list ...)
export AZURE_OPENAI_ENDPOINT="https://my-agent-openai.openai.azure.com"

# Run the code from the example above
npm start
```

---

## Common Gotchas

### "My memories aren't being found"

**Likely cause:** Vector search isn't enabled on your container.

**Fix:** Make sure you created Cosmos DB with `EnableNoSQLVectorSearch` and configured the vector index policy.

### "It's slow"

**Likely cause:** You're generating embeddings for every search.

**Fix:** Cache embeddings. If someone asks "What's my favorite color?" twice, reuse the embedding.

### "Memories are getting stale"

**Likely cause:** No decay system.

**Fix:** Add a `lastUsed` timestamp and update it on every retrieval. Run a nightly job to lower confidence on unused memories.

### "Too many duplicate memories"

**Likely cause:** Saving everything without checking for duplicates.

**Fix:** Before saving, search for similar memories (similarity > 0.9). If found, update instead of insert.

---

## Security (The Non-Negotiables)

1. **Never expose your AI directly to the internet** — Always put API Management in front
2. **Authenticate users** — Use Entra ID (Azure AD), not homegrown auth
3. **Isolate memories by user** — Partition by userId, enforce in queries
4. **Watch for prompt injection** — Filter inputs that try to override system prompts
5. **Log everything** — You'll need it for debugging and compliance

---

## Cost Reality Check

| Service | What You Pay For | Rough Monthly Cost |
|---------|-----------------|-------------------|
| Cosmos DB (Serverless) | Per operation | $5-50 for small apps |
| Azure OpenAI GPT-4o | Per 1K tokens | $10-100 depending on usage |
| Azure OpenAI Embeddings | Per 1K tokens | $0.10 per 1M tokens (cheap!) |
| Container Apps | Per vCPU-second | $0 when idle (serverless) |
| API Management | Per tier | $50+ (Consumption tier is cheaper) |

**Pro tip:** Embeddings are cheap. Generate them liberally. GPT-4 is expensive. Cache responses when possible.

---

## Next Steps

1. **Start simple** — Get the minimal example working first
2. **Add one thing at a time** — Memory, then tools, then events
3. **Test with real conversations** — Synthetic tests miss edge cases
4. **Monitor costs** — Set up Azure budget alerts

---

## Learn More

**Microsoft Docs:**

- [Azure MCP Server](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/overview) — Tool calling standard
- [Cosmos DB Vector Search](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/vector-search) — How the memory search works
- [Semantic Kernel](https://learn.microsoft.com/en-us/semantic-kernel/) — The orchestration framework
- [AI Agent Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — Architecture guidance

**Tutorials:**

- [Build an AI Agent on App Service](https://learn.microsoft.com/en-us/azure/app-service/tutorial-ai-agent-web-app-semantic-kernel-foundry-dotnet)
- [Agent Memory in Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/gen-ai/agentic-memories)

---

## Architecture Diagrams

See the included diagrams:

- [napkin-sketch.png](napkin-sketch.png) — The simple version
- [claude_architecture.png](claude_architecture.png) — The detailed version

---

Built for learners. Inspired by Feynman: "If you can't explain it simply, you don't understand it well enough."
