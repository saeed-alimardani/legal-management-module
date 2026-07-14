---
name: frozen-blueprint
description: Implements features by following the frozen blueprint with minimal, production-quality code. Use when building interview phases, implementing legal-management-module features, or when the user asks to follow the blueprint, avoid overengineering, or stop at a phase boundary.
---

# Frozen Blueprint Implementation

## Core principles

Follow the frozen blueprint.
Never overengineer.
Generate production-quality code.
Keep files small.
Explain important decisions with comments only when necessary.
Prefer readability over abstraction.
Stop after completing the requested phase.

## Before writing code

1. Read the frozen blueprint for the current phase (assignment spec, phase docs, or approved design).
2. Read `.cursor/rules/legal-management.mdc` for architecture and layer boundaries.
3. Confirm scope: implement **only** what the requested phase asks for.

Do not redesign architecture, add layers, or implement future phases unless explicitly requested.

## Implementation rules

| Principle | In practice |
|-----------|-------------|
| Follow the frozen blueprint | Match entities, endpoints, and behavior to the spec. Do not rename or restructure approved designs. |
| Never overengineer | No extra abstractions, libraries, or patterns beyond what the phase requires. |
| Production-quality code | Correct types, validation, authorization, error handling, and activity logging per project rules. |
| Keep files small | One focused responsibility per file; split when a file grows hard to scan. |
| Comments when necessary | Comment non-obvious business rules or tradeoffs only — not what the code already says. |
| Readability over abstraction | Prefer explicit, linear code over clever indirection or deep inheritance. |
| Stop after the phase | Do not add “nice to have” features, refactors, or next-phase work. |

## Phase completion checklist

Before finishing, verify:

- [ ] Only the requested phase scope was implemented
- [ ] Architecture matches the blueprint and four-layer DDD layout
- [ ] Project builds successfully
- [ ] TypeScript passes
- [ ] Prisma validation passes (if schema changed)
- [ ] All errors from the change are fixed

Then stop. Report what was done and what remains for later phases — do not continue into the next phase.
