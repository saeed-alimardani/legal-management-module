# AI Usage Notes

This project was built with assistance from **Cursor AI** (Claude). AI tools accelerated scaffolding and boilerplate; all architectural decisions and final code were reviewed manually.

---

## 1. Tools Used

| Tool | Purpose |
|------|---------|
| **Cursor IDE** | Primary development environment with integrated AI agent |
| **Claude (via Cursor)** | Code generation, architecture planning, refactoring, test writing |
| **Prisma CLI** | Schema design, migrations, seed data |
| **Jest + Supertest** | Unit, integration, and e2e test execution |
| **Docker Compose** | Local PostgreSQL + backend + frontend orchestration |
| **Swagger (@nestjs/swagger)** | Auto-generated API documentation |

---

## 2. Development Workflow

### Phase 0 — Planning

1. Defined core MVP requirements for a legal operations backend.
2. Used AI to draft an architecture plan covering stack, schema, API design, RBAC matrix, and phased delivery.
3. Locked architectural decisions: no CQRS, no repository interfaces, concrete Prisma repos, single `FileStoragePort`, explicit `ActivityLogService` calls.
4. Created `.cursor/rules/legal-management.mdc` to enforce four-layer DDD boundaries during AI generation.

### Phase 1–7 — Incremental Implementation

Each phase followed the same loop:

```
Read architecture plan for phase → AI generates code → Human review → Quality gate → Move on
```

| Phase | Scope |
|-------|-------|
| 0 | NestJS scaffold, Docker, Prisma schema, Pino, Swagger |
| 1 | Shared kernel: AccessControl, ActivityLog, guards, filters |
| 2 | Auth: login, JWT, seed users |
| 3 | Cases: full hexagonal template (CRUD, parties, reassign, timeline) |
| 4 | Deadlines: CRUD + four view filters |
| 5 | Contracts + Notices (notice auto-deadline transaction) |
| 6 | Tasks + Documents + Activity Log read API |
| 7 | Dashboard + Offboarding + seed + core tests + docs |
| 8 | Users, Discussions, Financial Records, Reminders + full test pyramid (791 tests) |
| 9 | Monorepo restructure (`backend/` + `frontend/`), CORS, Next.js UI for all API modules, Docker Compose for full stack |

### Quality Gate (after every phase)

```bash
cd backend
npm run build
npm run prisma:validate    # when schema changed
npm test                   # unit
npm run test:integration   # when repos changed
npm run test:e2e           # when endpoints changed

cd ../frontend
npm run build
```

### Human Review Checklist

For every AI-generated file, I manually verified:

- Authorization calls exist before reads and writes
- Mutations produce `ActivityLog` entries
- No Prisma imports in domain or presentation layers
- Controllers delegate only to use cases
- Tests assert real business behavior, not implementation details

---

## 3. Important Prompts (9)

These prompts shaped the project most significantly:

### Prompt 1 — Architecture Planning
> "Propose an MVP architecture for a NestJS legal management API using lightweight DDD + Hexagonal Architecture. Include Prisma schema, RBAC matrix, API endpoints, and phased delivery. Explicitly exclude CQRS, Redis, S3, microservices, and repository interfaces."

**Outcome:** Single source of truth document that prevented scope creep and architecture drift.

### Prompt 2 — Shared Kernel
> "Implement Phase 1 shared kernel: AccessControlService with canView/canEdit/buildListFilter for all roles, ActivityLogService with log() and logWithinTransaction(), JwtAuthGuard, RolesGuard, HttpExceptionFilter. No business logic in guards — only authentication."

**Outcome:** Centralized RBAC reused by every module without duplication.

### Prompt 3 — Cases Template Module
> "Implement the Cases module as the hexagonal template: concrete PrismaCaseRepository, use cases for CRUD/parties/reassign, activity logging on every mutation, soft-delete via deletedAt. Counsel sees only owned cases."

**Outcome:** Repeatable pattern copied for contracts, notices, tasks, documents.

### Prompt 4 — Deadline Views
> "Implement Deadlines module with view query param: upcoming, overdue, today, assigned-to-me. Use APP_TIMEZONE for today boundary. Counsel scope: deadlines on owned matters OR assigned to them. Index-friendly Prisma queries."

**Outcome:** Timezone-correct deadline filtering with role-based scoping.

### Prompt 5 — Notice Auto-Deadline
> "CreateNoticeUseCase must atomically create notice + linked deadline in one Prisma transaction. Log both CREATED events via logWithinTransaction. This is a documented pragmatic exception for direct PrismaService injection."

**Outcome:** Reliable notice intake with guaranteed deadline creation.

### Prompt 6 — Document Upload
> "Implement Documents with FileStoragePort interface and LocalFileStorageAdapter. Enforce 20MB limit and allowed MIME types. Access control inherits from parent matter. Soft-delete by uploadedBy or admin."

**Outcome:** Clean hexagonal port for the one external system (filesystem).

### Prompt 7 — Dashboard Live Counts
> "GetDashboardSummaryUseCase: no Dashboard table. Run parallel Prisma count() queries with role-scoped filters. Return openCases, activeContracts, pendingNotices, overdueDeadlines, todayDeadlines, myOpenTasks."

**Outcome:** Permission-aware dashboard without caching complexity.

### Prompt 8 — Test Coverage
> "Write unit tests for AccessControlService role matrix, create-notice transaction, deadline view filters, and e2e tests for auth + cases + offboarding. Use real PostgreSQL for integration/e2e via test helpers."

**Outcome:** Initial test pyramid for core modules.

### Prompt 9 — Full Endpoint Test Coverage
> "Add unit, integration, and e2e tests for every API endpoint — including users, discussions, financial-records, reminders, deadlines HTTP layer, case timeline, and party update/delete. Fix flaky test cleanup helpers."

**Outcome:** 791 tests across 80 suites covering all ~62 endpoints with RBAC, validation, and lifecycle scenarios.

---

## 4. AI Mistakes or Limitations (4)

### Mistake 1 — Repository Interfaces Everywhere
**What happened:** Early AI suggestions introduced `ICaseRepository`, `IDeadlineRepository`, and provider token bindings for every entity.

**Why it was wrong:** The architecture plan chose concrete Prisma repos to reduce boilerplate. Interfaces add indirection without benefit when there is only one implementation.

**Correction:** Removed all repository interfaces. Use cases inject `PrismaCaseRepository` directly. Kept only `FileStoragePort` as the single port.

### Mistake 2 — Audit Logging via Interceptor
**What happened:** AI proposed a global NestJS interceptor or Prisma middleware to auto-log all mutations.

**Why it was wrong:** Interceptors cannot access use-case context (e.g., which fields changed, transaction boundaries). Notice+deadline create requires logging inside the transaction.

**Correction:** Explicit `activityLogService.log()` calls in each use case. Transaction variant for multi-aggregate writes.

### Mistake 3 — Dashboard Materialized Table
**What happened:** AI suggested a `dashboard_snapshots` table updated by a cron job for performant aggregates.

**Why it was wrong:** Overengineered for current scale. Adds stale data risk and background job infrastructure not needed yet.

**Correction:** Live `count()` queries in `GetDashboardSummaryUseCase` with role-scoped `where` clauses.

### Mistake 4 — Duplicate Path Separators in Tests
**What happened:** On Windows, AI occasionally created files with mixed `src\modules\...` and `src/modules/...` paths, and duplicate test files with different path separators.

**Why it was wrong:** Git on Windows can track the same logical file twice; imports become inconsistent.

**Correction:** Standardized forward-slash paths; removed duplicate files; verified with `git status` after each phase.

### General AI Limitations

- AI sometimes generates plausible but incorrect RBAC (e.g., allowing counsel to reassign ownership).
- AI test mocks occasionally don't match actual repository method signatures — caught by TypeScript compile.
- AI tends to add "helpful" extras (refresh tokens, email service, CQRS handlers) that exceed the intended scope.

---

## 5. What I Personally Decided

These decisions were mine, not delegated to AI:

| Decision | My Reasoning |
|----------|-------------|
| **API-first, no frontend** | Backend architecture and API design are the focus of this repo |
| **NestJS + Prisma** | Typed, testable stack with first-class migrations |
| **Concrete repos, one port** | Pragmatic hexagonal — ports only where the external system varies (filesystem) |
| **Soft delete everywhere** | Legal data should not be hard-deleted from a user-facing API |
| **Asia/Tehran default timezone** | Natural default for Persian date support in responses |
| **Jalali output only, Gregorian input** | API clients send ISO dates; conversion is a presentation concern |
| **Counsel activity log scoping** | Counsel sees only their own actions — tighter than read-all, looser than matter-scoped |
| **Bulk offboarding transfers assigneeId on tasks/deadlines, not ownerId** | Tasks/deadlines use assignee model; ownership transfer must follow actual data model |
| **User management API (admin/manager only)** | Seed users cover demo login; admin API supports creating and deactivating accounts for real onboarding |
| **20 MB upload limit** | Balances usability with local disk storage safety |
| **`.cursor/` and `.idea/` in `.gitignore`** | IDE/agent config is local workflow tooling, not part of the deliverable |
| **Phase-by-phase quality gate** | Never proceed with failing build or tests |

---

## 6. Exploring the Project

1. Follow [README.md](./README.md) for Docker or local setup.
2. Run `cd backend && npx prisma migrate deploy && npx prisma db seed`.
3. Open the UI at `http://localhost:3001` or Swagger at `http://localhost:3000/api/docs`.
4. Login with `counsel@legal.local` / `Password123!`.
5. Read [README.md](./README.md) for full architecture and API reference.

The codebase is structured so each module can be understood and extended independently. The Cases module is the canonical template for adding new features.

---

## 7. Accountability

AI was used as a **productivity accelerator** for scaffolding, boilerplate, and test generation. Every generated file was reviewed, and the quality gate was run after each phase.

Final accountability for correctness, security, and design tradeoffs remains with the developer.
