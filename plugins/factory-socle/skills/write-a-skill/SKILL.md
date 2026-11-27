---
name: write-a-skill
description: Create new agent skills with proper structure, progressive disclosure, and bundled resources. Use when user wants to create, write, build, or author a new skill from scratch. Do not use to audit, score, refactor, or improve an existing skill (use ameliore-un-skill instead).
license: MIT
metadata:
  derived_from: "https://github.com/mattpocock/skills/tree/main/skills/productivity/write-a-skill"
  original_author: "Matt Pocock (@mattpocock)"
  original_license: MIT
  voice: "Matt Pocock — direct, concrete, imperative, example-driven"
  version: 1.1.0
---

# Writing Skills

> Derived from [Matt Pocock's write-a-skill](https://github.com/mattpocock/skills/tree/main/skills/productivity/write-a-skill) (MIT). Matt's voice and 3-phase workflow preserved verbatim. Additions: validation scripts + references + cs-* wrapper (see *Scripts + Companions*).

## Process

1. **Gather requirements** - ask user about: what task/domain the skill covers, what use cases it handles, whether it needs executable scripts or just instructions, any reference materials to include.
2. **Draft the skill** - create SKILL.md with concise instructions, reference files if content exceeds 500 lines, utility scripts if deterministic operations are needed.
3. **Review with user** - present the draft and ask: does this cover your use cases? anything missing or unclear? should any section be more/less detailed?

## Skill Structure

```
skill-name/
├── SKILL.md           # Main instructions (required)
├── REFERENCE.md       # Detailed docs (if needed)
├── EXAMPLES.md        # Usage examples (if needed)
└── scripts/           # Utility scripts (if needed)
```

## SKILL.md Template

```md
---
name: skill-name
description: Brief description of capability. Use when [specific triggers].
---
# Skill Name
## Quick start
[Minimal working example]
## Workflows
[Step-by-step processes with checklists for complex tasks]
## Advanced features
[Link one level deep to a detail file]
```

## Description Requirements

The description is **the only thing your agent sees** when picking a skill. Give it enough to know (1) what the skill does and (2) when to trigger it. Max 1024 chars, third person. First sentence = what it does; second = "Use when [specific triggers]".

- Good: `Extract text and tables from PDFs, fill forms, merge documents. Use when working with PDF files...`
- Bad: `Helps with documents.` (no way to distinguish it from other doc skills).

Full pattern library — trigger sentences, vocabulary, anti-patterns: see [references/description_design_patterns.md](references/description_design_patterns.md).

## When to Add Scripts

Add a utility script when the operation is deterministic (validation, formatting), the same code would be generated repeatedly, or errors need explicit handling. Scripts save tokens and improve reliability vs generated code.

## When to Split Files

Split into separate files when SKILL.md nears 100 lines, content spans distinct domains, or advanced features are rarely needed. Keep references one level deep. Detail: see [references/progressive_disclosure_principles.md](references/progressive_disclosure_principles.md).

## Review Checklist

After drafting, verify:

- [ ] Description includes triggers ("Use when...")
- [ ] SKILL.md under 100 lines
- [ ] No time-sensitive info
- [ ] Consistent terminology
- [ ] Concrete examples included
- [ ] References one level deep

Rationale and CI sequencing: see [references/quality_gates_for_skills.md](references/quality_gates_for_skills.md).

## Scripts + Companions

Validation scripts + cs-* wrapper sit alongside this skill. Run all 6 review-checklist items programmatically:

```
python scripts/skill_review_checklist_runner.py path/to/skill-folder
```

Once it passes, package the deliverable into an installable `.zip` — the script walks the whole folder, gates on the validators + upload limits, and refuses to ship a non-conformant skill (use `--force` to override):

```
python scripts/package_skill.py path/to/skill-folder --out path/to/skill-name.zip
```

See [references/companion_tooling.md](references/companion_tooling.md) for the script catalogue, cs-skill-author persona agent, and `/cs:write-a-skill` slash command.

---
**Version:** 1.1.0 · **Derived:** Matt Pocock (MIT) + this repo's wrapper
