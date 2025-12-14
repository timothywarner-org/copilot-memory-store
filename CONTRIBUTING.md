# Contributing to Copilot Memory Store

First off, thank you for considering contributing! This project is designed for **teaching and learning**, so contributions of all experience levels are welcome.

## Table of Contents

- [Quick Start](#quick-start)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Learning Resources](#learning-resources)
- [Getting Help](#getting-help)

## Quick Start

```bash
# 1. Fork the repo on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR-USERNAME/copilot-memory-store.git
cd copilot-memory-store

# 3. Install dependencies
npm install

# 4. Create a branch for your changes
git checkout -b feature/your-feature-name

# 5. Make your changes, then build and test
npm run build

# 6. Commit and push
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name

# 7. Open a Pull Request on GitHub
```

## Ways to Contribute

### For Beginners

- **Fix typos** - Documentation improvements are valuable!
- **Add comments** - Help others understand complex code
- **Write examples** - Show how to use features
- **Report bugs** - Open an issue describing what went wrong
- **Ask questions** - Your questions help improve docs

### For Intermediate Contributors

- **Add tests** - Improve code reliability
- **Improve error messages** - Make debugging easier
- **Add CLI commands** - Extend functionality
- **Enhance documentation** - Write tutorials or guides

### For Advanced Contributors

- **New MCP tools** - Extend the MCP server capabilities
- **Performance optimization** - Make things faster
- **Architecture improvements** - Propose structural changes
- **New integrations** - Add support for other AI tools

### For Educators

- **Curriculum ideas** - Suggest teaching applications
- **Workshop materials** - Create educational content
- **Feedback** - Share how you use this in teaching

## Development Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **VS Code** (recommended for testing the agent)
- **Git**

### Environment Setup

1. **Clone and install:**

   ```bash
   git clone https://github.com/timothywarner-org/copilot-memory-store.git
   cd copilot-memory-store
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

4. **Test the CLI:**

   ```bash
   npm run dev
   ```

5. **Test the MCP server:**

   ```bash
   npm run inspect:dev
   ```

### Project Structure

```text
.github/
└── agents/
    └── memory.agent.md   # VS Code custom agent
.vscode/
└── mcp.json              # MCP server config
src/
├── cli.ts                # Interactive CLI
├── mcp-server.ts         # MCP server (tools, resources, prompts)
├── memoryStore.ts        # Core storage and search logic
└── deepseek.ts           # LLM compression integration
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-export-csv` - New features
- `fix/search-scoring-bug` - Bug fixes
- `docs/improve-readme` - Documentation
- `refactor/simplify-compression` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): description

[optional body]

[optional footer]
```

**Types:**

| Type | Use For |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `docs` | Documentation changes |
| `style` | Formatting (no code change) |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

**Examples:**

```text
feat(mcp): add memory_stats tool
fix(cli): handle empty search results gracefully
docs: add MCP Inspector usage guide
refactor(store): simplify keyword extraction
```

### What to Include

When making changes:

1. **Update documentation** if you change behavior
2. **Add comments** for complex logic
3. **Consider backwards compatibility**
4. **Test your changes** manually with CLI and MCP Inspector

## Pull Request Process

### Before Submitting

- [ ] Code builds without errors (`npm run build`)
- [ ] Changes work in CLI (`npm run dev`)
- [ ] Changes work in MCP Inspector (`npm run inspect:dev`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions

### PR Template

When opening a PR, include:

```markdown
## Summary
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## How to Test
Steps to verify the changes work.

## Screenshots (if applicable)
Show UI changes or CLI output.

## Learning Notes (optional)
Share what you learned while making these changes!
```

### Review Process

1. **Automated checks** - Build must pass
2. **Maintainer review** - Usually within a few days
3. **Feedback** - We'll provide constructive feedback
4. **Merge** - Once approved, we'll merge your PR!

## Coding Standards

### TypeScript

- Use **strict mode** (already configured)
- Prefer **explicit types** over `any`
- Use **async/await** over raw Promises
- Add **JSDoc comments** for public functions

### Style Guidelines

```typescript
// Good: Explicit types, clear naming
async function searchMemories(query: string, limit: number): Promise<MemoryRecord[]> {
  // Implementation
}

// Avoid: Implicit any, unclear names
async function search(q, l) {
  // Implementation
}
```

### File Organization

- One primary export per file
- Related utilities can be in the same file
- Keep files under 300 lines when practical

## Learning Resources

New to some of these technologies? Here are helpful resources:

### MCP (Model Context Protocol)

- [MCP Specification](https://modelcontextprotocol.io/specification/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [VS Code MCP Docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)

### TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Git & GitHub

- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)

### VS Code Extensions

- [VS Code Custom Agents](https://code.visualstudio.com/docs/copilot/chat/customization/custom-agents)
- [Extension API](https://code.visualstudio.com/api)

## Getting Help

### Questions?

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and ideas
- **Email** - [tim@techtrainertim.com](mailto:tim@techtrainertim.com)
- **Website** - [techtrainertim.com](https://techtrainertim.com)

### Stuck on Something?

1. Check existing issues - someone may have asked before
2. Read the docs - README, CLI_GUIDE, COPILOT_INSTRUCTIONS
3. Open an issue - we're happy to help!

---

## Recognition

Contributors are recognized in:

- GitHub's contributor graph
- Release notes for significant contributions
- Special thanks in documentation for major features

Thank you for helping make this project better!
