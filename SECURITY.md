# Security Policy

## Overview

This document outlines security procedures and policies for the Copilot Memory Store project.

**Important:** This project stores data **locally** in a JSON file. It does not transmit your memories to external servers (except optionally to DeepSeek for LLM compression, if configured).

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Security Model

### What This Project Does

- Stores memories in a **local JSON file** on your machine
- Runs an **MCP server** that communicates via stdio (not network)
- Optionally calls **DeepSeek API** for LLM-assisted compression

### Data Storage

```text
Location: Configured via MEMORY_PATH environment variable
Default:  project-memory.json (in project directory)
Format:   Plain JSON (not encrypted)
```

### Security Considerations

| Aspect | Status | Notes |
|--------|--------|-------|
| Data at rest | Not encrypted | JSON stored as plaintext |
| Data in transit | Local stdio | No network transmission (except optional DeepSeek) |
| Authentication | None | Local tool, no auth required |
| Access control | File system | Relies on OS file permissions |

## Reporting a Vulnerability

### Where to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, report them via email:

**Tim Warner**
Email: [tim@techtrainertim.com](mailto:tim@techtrainertim.com)

### What to Include

Please include:

1. **Description** - What is the vulnerability?
2. **Impact** - What could an attacker do?
3. **Steps to reproduce** - How can we verify it?
4. **Affected versions** - Which versions are impacted?
5. **Suggested fix** (optional) - If you have ideas

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Fix development | Depends on severity |
| Public disclosure | After fix is released |

### What to Expect

1. **Acknowledgment** - We'll confirm receipt of your report
2. **Communication** - We'll keep you updated on progress
3. **Credit** - You'll be credited in the fix (unless you prefer anonymity)
4. **No legal action** - We won't pursue legal action for good-faith security research

## Security Best Practices

### For Users

#### Protect Your Memory File

```bash
# Recommended: Store memories outside of git-tracked directories
MEMORY_PATH=/Users/you/.copilot-memory/memories.json

# Or add to .gitignore
echo "*.memory.json" >> .gitignore
echo "project-memory.json" >> .gitignore
```

#### Sensitive Information

**DO NOT store in memories:**

- Passwords or API keys
- Personal identification numbers
- Financial information
- Private keys or tokens
- Confidential business data

**Safe to store:**

- Coding preferences
- Architectural decisions
- Project conventions
- Learning notes

#### DeepSeek API Usage

If using LLM compression:

```bash
# Keep your API key secure
# Never commit .env files
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### For Developers

#### Code Security

When contributing:

- **Sanitize inputs** - Validate all tool inputs
- **No eval()** - Never execute arbitrary code
- **Escape outputs** - Prevent injection in formatted output
- **Minimal dependencies** - Fewer deps = smaller attack surface

#### Dependency Management

```bash
# Check for vulnerabilities
npm audit

# Update dependencies regularly
npm update
```

## Known Limitations

### Not Designed For

This project is **NOT** designed for:

- Storing sensitive/confidential data
- Multi-user environments
- Production security-critical applications
- Compliance requirements (HIPAA, PCI, etc.)

### Educational Context

This project is primarily for **teaching and learning**:

- Context engineering concepts
- MCP protocol development
- VS Code extension development
- LLM tool integration

Security features are intentionally minimal to keep the codebase accessible for learning.

## Security Checklist

### Before Using in Any Environment

- [ ] Review what data you plan to store
- [ ] Configure `MEMORY_PATH` to a secure location
- [ ] Add memory files to `.gitignore`
- [ ] Keep API keys in `.env` (not committed)
- [ ] Understand this is a local-only tool

### Before Contributing

- [ ] Review code for security implications
- [ ] Don't introduce network calls without discussion
- [ ] Validate all user inputs
- [ ] Document any security-relevant changes

## Questions?

For security questions that aren't vulnerabilities:

- Open a GitHub Discussion
- Email [tim@techtrainertim.com](mailto:tim@techtrainertim.com)
- Visit [techtrainertim.com](https://techtrainertim.com)

---

*This security policy was last updated: December 2024*
