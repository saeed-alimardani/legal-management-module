# AI Usage Disclosure

This project was implemented with assistance from **Cursor AI** (Claude) as part of an AI-assisted coding interview assignment.

## How AI Was Used

### Architecture & Planning

- AI helped interpret the assignment PDF and produce a **frozen implementation blueprint** (lightweight DDD + Hexagonal Architecture).
- Module boundaries, database schema, API design, and phased delivery plan were agreed before coding began.
- The blueprint was treated as a single source of truth — no mid-build architecture changes.

### Implementation

AI generated NestJS module scaffolding following the blueprint:

- Shared kernel (AccessControl, ActivityLog, guards, filters)
- Feature modules: Auth, Cases, Contracts, Notices, Deadlines, Tasks, Documents, Dashboard, Offboarding
- Prisma schema, migrations, and seed script
- Unit, integration, and e2e tests
- Docker Compose, Dockerfile, README

All generated code was reviewed and adjusted for correctness, consistency with project rules, and interview-appropriate simplicity.

### What I Verified Manually

- Authorization rules match the RBAC spec (role guards + use-case-level checks)
- Every mutation writes an ActivityLog entry
- Notice creation atomically creates a linked deadline in a transaction
- Dashboard uses live `count()` queries with correct scope filters
- Offboarding runs as a single transaction with audit logging
- Tests pass against a real PostgreSQL database

### What AI Did Not Decide

- No CQRS, event sourcing, Redis, S3, or microservices (explicitly excluded)
- No repository interfaces (concrete Prisma repos only; one `FileStoragePort` exception)
- No Dashboard table or caching layer
- No user management API beyond seed users

## Prompting Approach

1. **Phase-by-phase delivery** — one module group at a time to keep scope controlled.
2. **Frozen blueprint reference** — every phase cited the approved design doc.
3. **Quality gate** — build, type-check, Prisma validate, and tests after each phase.
4. **Minimal diffs** — avoid overengineering; match existing code style.

## Tools

| Tool | Purpose |
|------|---------|
| Cursor IDE | Primary development environment |
| Claude (via Cursor) | Code generation, refactoring, test writing |
| Prisma | Schema and migration management |
| Jest + Supertest | Unit, integration, and e2e testing |

## Limitations & Human Judgment

AI suggestions were rejected when they:

- Added unnecessary abstractions (repository interfaces, domain events, interceptors for audit)
- Expanded scope beyond the MVP (notifications, email, refresh tokens)
- Broke the four-layer architecture rules

Final architectural accountability remains with the developer; AI was a productivity accelerator, not an autonomous author.

## Reproducibility

To reproduce the setup without AI:

1. Follow `README.md` for Docker/local setup.
2. Run `npx prisma migrate deploy && npx prisma db seed`.
3. Open Swagger at `http://localhost:3000/api/docs`.
4. Login with `counsel@legal.local` / `Password123!`.

The codebase is structured so each module can be understood and extended independently.
