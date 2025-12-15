# GitHub Copilot Chat Examples

Real prompts you can copy-paste. Organized by use case.

## Setup Reminder

1. Build: `npm run build`
2. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Open Copilot Chat: `Ctrl+Alt+I`
4. Select the **Memory** agent from the dropdown

---

## Storing Memories

### Preferences

```
Remember that I prefer functional components over class components in React
```

```
Save this preference: always use named exports, never default exports
```

```
Note: I like 2-space indentation, no semicolons, single quotes
```

```
Store my preference for using Tailwind CSS utility classes instead of custom CSS
```

```
Remember: I prefer async/await over .then() chains
```

### Decisions

```
Save this decision: we're using PostgreSQL for the main database because we need ACID compliance and complex queries
```

```
Remember our architecture decision: microservices communicate via RabbitMQ message queue
```

```
Store this: we chose JWT tokens over sessions for authentication because we need stateless scaling
```

```
Note this decision: API versioning will use URL path (/v1/, /v2/) not headers
```

```
Remember: error responses follow RFC 7807 Problem Details format
```

### Patterns & Conventions

```
Save this pattern: all API endpoints return { data, meta, errors } structure
```

```
Remember our naming convention: React components use PascalCase, hooks use camelCase with 'use' prefix
```

```
Store this pattern: repository pattern for all database access, no direct queries in services
```

```
Note: we use barrel exports (index.ts) for each feature module
```

```
Remember the logging pattern: structured JSON logs with correlation IDs
```

### Context & Facts

```
Remember that this project uses Node 20 LTS and TypeScript 5.3
```

```
Save context: the main API runs on port 3000, admin API on 3001
```

```
Note: CI/CD runs on GitHub Actions, deploys to AWS ECS
```

```
Remember: the legacy system we're migrating from uses Oracle DB
```

```
Store this context: our team is in PST timezone, standup at 9am
```

---

## Searching & Recalling

### Basic Search

```
What preferences do I have stored?
```

```
Find my notes about the database
```

```
What did we decide about authentication?
```

```
Search for anything about React patterns
```

```
Show me memories tagged with 'decision'
```

### Specific Recalls

```
What was our API versioning decision?
```

```
Recall my TypeScript preferences
```

```
What patterns do we use for error handling?
```

```
Find the memory about our deployment setup
```

```
What conventions do we have for naming?
```

### Context Before Tasks

```
Before I start, what context do I have about the auth module?
```

```
What should I know before working on the API endpoints?
```

```
Find relevant memories for refactoring the user service
```

```
What preferences apply to writing React components?
```

---

## Using Inject-Context (The Good Stuff)

### Basic Injection

```
Help me refactor the auth module, use my stored preferences
```

```
I need to add form validation - inject relevant context first
```

```
With my preferences in mind, help me write a new API endpoint
```

### Explicit Injection Requests

```
Inject context for: building a new React component for user settings
```

```
Use inject-context with shaping for: migrating the payment service to TypeScript
```

```
Get my stored context about database patterns, then help me write a new query
```

### Complex Tasks with Context

```
I'm about to refactor the entire auth flow. Pull in all relevant decisions and preferences, then outline an approach.
```

```
Using everything you know about our patterns, help me design a new notification service
```

```
Based on my stored architecture decisions, review this PR for consistency
```

---

## Memory Management

### Deleting Memories

```
Delete the memory about the old database decision (ID: m_20241201T...)
```

```
Remove my outdated preference for class components
```

```
Forget what I said about using Moment.js
```

### Purging by Criteria

```
Purge all memories tagged 'outdated'
```

```
Remove all memories mentioning 'legacy system'
```

```
Delete everything tagged 'temp' or 'test'
```

### Viewing Stats

```
Show me memory statistics
```

```
How many memories do I have stored?
```

```
What are my most used tags?
```

### Exporting

```
Export all my memories as JSON
```

```
Show me the raw memory data
```

---

## Workshop Scenarios

### Scenario 1: New Developer Onboarding

```
# First, load the team's context
What decisions and patterns should I know about this codebase?

# Then ask specific questions
What's our error handling pattern?
What database conventions do we follow?
How do we structure React components?
```

### Scenario 2: Starting a New Feature

```
# Step 1: Store the feature context
Remember: we're building a notification system that supports email, SMS, and push

# Step 2: Store decisions as you make them
Save decision: notifications will be async via message queue
Save decision: user preferences stored in separate notifications_preferences table

# Step 3: Pull context when coding
Help me implement the notification service, using our stored patterns
```

### Scenario 3: Code Review with Context

```
# Before reviewing, pull relevant standards
What are our code standards and patterns for TypeScript services?

# Then ask for review
Review this code against our stored conventions: [paste code]
```

### Scenario 4: Architecture Discussion

```
# Store the discussion outcomes
Remember decision: we chose event sourcing for the order service because we need full audit history

Remember decision: CQRS pattern for order queries - separate read models

Remember: order events published to Kafka topic 'orders.events'

# Later, recall for implementation
What architecture decisions do we have for the order service?
```

---

## Direct Tool References (Alternative Syntax)

Instead of natural language, you can reference tools directly with `#`:

```
#memory_write text: "Prefer composition over inheritance" tags: ["preference", "oop"]
```

```
#memory_search query: "database" limit: 10
```

```
#memory_compress query: "all patterns" budget: 1000
```

```
#memory_export
```

---

## Power User Tips

### Combining with File Context

```
@workspace Based on my stored preferences, review src/services/auth.ts
```

```
Using my memory context, explain what #file:src/api/routes.ts does
```

### Multi-Step Workflows

```
1. Search my memories for React patterns
2. Then help me create a new component following those patterns
3. Save any new decisions we make
```

### Tagging Strategy

Use consistent tags for better search:
- `preference` - Personal coding style
- `decision` - Team/architecture decisions
- `pattern` - Code patterns and conventions
- `context` - Project facts and setup
- `todo` - Things to remember to do
- `learned` - Lessons learned, gotchas

### Budget Optimization

```
# Small context for simple tasks
Compress my React preferences to 500 chars, then help me write a component

# Large context for complex tasks
Get comprehensive context (2000 chars) about our API patterns for this refactor
```

---

## Prompt Files (Slash Commands)

If you have the prompt files set up in `.github/prompts/`:

```
/add-memory
```
Guides you through storing a memory with proper tags.

```
/retrieve-memory
```
Helps you search and find stored memories.

```
/inject-memory
```
Injects shaped context before a task.

---

## Common Patterns

### The "Remember and Use" Pattern

```
# Store something
Remember: error messages should be user-friendly, technical details in logs only

# Immediately use it
Now help me write error handling for the payment API using that approach
```

### The "Recall Before Coding" Pattern

```
# Always start complex tasks this way
What context do I have about [topic]?
# Then
Using that context, help me [task]
```

### The "Decision Log" Pattern

```
# After any significant decision
Save as decision: [what] because [why]. Tags: decision, [area]

# Example
Save as decision: using Zod for runtime validation because it integrates well with TypeScript and provides good error messages. Tags: decision, validation, typescript
```
