# Building Skills for Claude — Distilled Guide

## What is a Skill?

A skill is a folder of instructions that teaches Claude how to handle a specific task or workflow. Instead of re-explaining your process every session, you define it once and it applies every time.

**Skill folder structure:**
```
your-skill-name/
├── SKILL.md          # Required
├── scripts/          # Optional: Python, Bash, etc.
├── references/       # Optional: docs loaded as needed
└── assets/           # Optional: templates, fonts, icons
```

---

## Core Design Principles

**Progressive disclosure** — three levels of loading:
1. YAML frontmatter → always in system prompt (when to load)
2. `SKILL.md` body → loaded when skill is relevant (what to do)
3. Linked files → loaded only as needed (supporting detail)

**Composability** — skills should work alongside others, not assume exclusivity.

**Portability** — works identically on Claude.ai, Claude Code, and API.

---

## Skills + MCP

If you have an MCP server, skills are the knowledge layer on top:

| MCP | Skills |
|-----|--------|
| Connects Claude to your service | Teaches Claude how to use it effectively |
| Provides real-time data & tool access | Captures workflows and best practices |
| What Claude *can* do | How Claude *should* do it |

---

## Planning: Start with Use Cases

Before writing anything, define 2–3 concrete use cases:

```
Use Case: Sprint Planning
Trigger: "help me plan this sprint"
Steps:
  1. Fetch project status (MCP)
  2. Analyze capacity
  3. Suggest prioritization
  4. Create tasks with labels/estimates
Result: Fully planned sprint
```

**Three common categories:**
- **Category 1 — Document & Asset Creation**: Consistent output (docs, designs, code). Uses Claude's built-in capabilities, no external tools needed.
- **Category 2 — Workflow Automation**: Multi-step processes with validation gates and iterative refinement.
- **Category 3 — MCP Enhancement**: Workflow guidance layered on top of existing MCP tool access.

---

## Technical Requirements

### Critical naming rules
- Folder: `kebab-case` only — `notion-project-setup` ✅, `Notion Project Setup` ❌
- File: must be exactly `SKILL.md` (case-sensitive)
- No `README.md` inside the skill folder (put docs in `references/`)

### YAML Frontmatter

Minimal required:
```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

Full optional fields:
```yaml
---
name: skill-name
description: Required. Under 1024 chars. No XML tags (< >).
license: MIT
allowed-tools: "Bash(python:*) WebFetch"
metadata:
  author: Your Name
  version: 1.0.0
  mcp-server: server-name
---
```

**Forbidden in frontmatter:** XML angle brackets (`< >`), names starting with `claude` or `anthropic`.

### Writing a good `description`

Format: `[What it does] + [When to use it] + [Key capabilities]`

```yaml
# Good
description: Manages Linear project workflows including sprint planning and task
  creation. Use when user mentions "sprint", "Linear tasks", or asks to "create tickets".

# Bad
description: Helps with projects.
```

---

## Instruction Body Template

```markdown
---
name: your-skill
description: [...]
---

# Skill Name

## Step 1: [First Step]
What happens. Example command if applicable.

## Step 2: [Next Step]
...

## Examples

**User says:** "Set up a new marketing campaign"
**Actions:**
1. Fetch existing campaigns via MCP
2. Create campaign with provided parameters
**Result:** Campaign created with confirmation link

## Troubleshooting

**Error:** [Common error]
**Cause:** [Why]
**Solution:** [Fix]
```

**Best practices for instructions:**
- Be specific and actionable — include exact commands, not vague directives
- Put critical steps at the top with `## Critical` or `## Important` headers
- Use bullet/numbered lists; avoid walls of prose
- Move detailed reference material to `references/` and link to it
- For non-negotiable validations, use a script — code is deterministic, language isn't

---

## Testing

### Three areas to cover

**1. Triggering tests**
- Should trigger on obvious and paraphrased requests
- Should NOT trigger on unrelated queries
- Debug: ask Claude "When would you use the [skill name] skill?" — it will quote the description back

**2. Functional tests**
- Valid outputs generated
- API calls succeed
- Edge cases handled

**3. Performance comparison**

| Metric | Without Skill | With Skill |
|--------|--------------|------------|
| Setup | User explains each time | Automatic |
| Messages | 15 back-and-forth | 2 clarifying questions |
| Failed API calls | 3 | 0 |
| Tokens | 12,000 | 6,000 |

### Iteration signals

| Signal | Fix |
|--------|-----|
| Skill doesn't load when it should (undertriggering) | Add more keywords and trigger phrases to description |
| Skill loads for unrelated queries (overtriggering) | Add negative triggers; narrow the scope |
| Inconsistent execution | Improve instructions; add validation scripts |

**Pro tip:** Iterate on a single hard task until Claude succeeds, then extract that approach into the skill. Faster signal than broad testing.

---

## Patterns

### Pattern 1: Sequential Workflow
For multi-step processes in a fixed order. Use explicit step numbering, dependencies, and rollback instructions for failures.

### Pattern 2: Multi-MCP Coordination
For workflows spanning multiple services (e.g. Figma → Drive → Linear → Slack). Use clear phase separation and validate before moving to the next phase.

### Pattern 3: Iterative Refinement
For output quality that improves with iteration. Include a validation script, a refinement loop, and an explicit stopping condition.

### Pattern 4: Context-Aware Tool Selection
For same outcome via different tools depending on context. Use a decision tree with clear criteria and transparency to the user about why a path was chosen.

### Pattern 5: Domain-Specific Intelligence
For embedding compliance rules, domain expertise, or governance logic. Run checks before action; document everything for audit trail.

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Could not find SKILL.md" | Wrong filename casing | Rename to exactly `SKILL.md` |
| "Invalid frontmatter" | YAML formatting issue | Ensure `---` delimiters are present and quotes are closed |
| "Invalid skill name" | Spaces or capitals in name | Use `kebab-case` only |
| Skill never loads | Description too vague | Add specific trigger phrases users would actually say |
| Skill loads too often | Description too broad | Add negative triggers; be more specific |
| MCP calls fail | Connection/auth issue | Test MCP independently first; verify API keys and tool names |
| Instructions ignored | Too verbose or buried | Put critical rules at the top; use scripts for non-negotiable checks |
| Slow/degraded responses | SKILL.md too large | Keep under 5,000 words; move docs to `references/` |

---

## Distribution

### How users install skills
1. Download the skill folder
2. Zip if needed
3. Upload via Claude.ai → Settings → Capabilities → Skills
4. Or place in Claude Code skills directory

### Recommended hosting approach
1. **GitHub** — public repo, clear README (separate from the skill folder itself), example usage
2. **MCP docs** — link to skill, explain combined value, provide quick-start guide
3. **Installation guide** — clone or download ZIP → upload to Claude → enable → test

### Description framing
Focus on outcomes, not implementation:
```
# Good
"The ProjectHub skill enables teams to set up complete workspaces in seconds
instead of spending 30 minutes on manual setup."

# Bad
"A folder containing YAML frontmatter and Markdown instructions."
```

---

## Pre-Upload Checklist

- [ ] 2–3 concrete use cases defined
- [ ] Folder named in `kebab-case`
- [ ] File named exactly `SKILL.md`
- [ ] YAML frontmatter has `---` delimiters
- [ ] `name` is kebab-case, no spaces or capitals
- [ ] `description` includes WHAT and WHEN (trigger phrases)
- [ ] No XML tags (`< >`) anywhere
- [ ] Instructions are specific and actionable
- [ ] References linked, not inlined
- [ ] Tested: triggers on obvious + paraphrased requests
- [ ] Tested: does NOT trigger on unrelated topics
- [ ] MCP tool names verified (case-sensitive)

---

## Resources

- [Best Practices Guide](https://anthropic.com)
- [Skills Documentation](https://anthropic.com)
- [API Reference](https://anthropic.com)
- [Public skills repo: anthropics/skills](https://github.com/anthropics/skills)
- [Claude Developers Discord](https://discord.gg/anthropic)
- `skill-creator` skill — built into Claude.ai, generates and reviews skills from descriptions
