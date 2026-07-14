# Legal Management Module

Internal legal operations API for managing cases, contracts, notices, deadlines, reminders, tasks, documents, discussions, and financial records. Built with NestJS, PostgreSQL, Prisma, and JWT authentication.

> **Development notes:** [AI_USAGE.md](./AI_USAGE.md) — how AI tools were used in this project.

## Table of Contents

- [Stack](#stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Seed Credentials](#seed-credentials)
- [Authentication](#authentication)
- [API Overview](#api-overview)
- [API Reference](#api-reference)
- [Roles & Authorization](#roles--authorization)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Business Rules](#business-rules)
- [Persian Date Handling](#persian-date-handling)
- [Activity Log & Audit Trail](#activity-log--audit-trail)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Feature Coverage](#feature-coverage)
- [Future Improvements](#future-improvements)
- [License](#license)

## Stack

- **Framework:** NestJS 10
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** JWT (Passport) + bcrypt
- **Docs:** Swagger at `/api/docs`
- **Logging:** Pino (nestjs-pino)
- **Architecture:** Lightweight DDD + Hexagonal (4 layers per module)

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 16 (if running locally without Docker)

## Quick Start

### Docker

```bash
cd legal-management-module
cp .env.example .env
docker compose up --build

# First-time setup (separate terminal)
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

### Local development

```bash
docker compose up postgres -d
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

The API is available at `http://localhost:3000`.

| Resource | URL |
|----------|-----|
| Health | `GET /health` |
| Swagger | `http://localhost:3000/api/docs` |
| API base | `/api/v1` |

## Environment Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://legal:legal@localhost:5432/legal_management` | PostgreSQL connection |
| `JWT_SECRET` | `change-me-to-a-long-random-secret` | JWT signing secret (32+ chars) |
| `JWT_EXPIRES_IN` | `8h` | Token TTL |
| `PORT` | `3000` | HTTP port |
| `APP_TIMEZONE` | `Asia/Tehran` | Timezone for today/overdue deadline logic |
| `UPLOAD_DIR` | `./uploads` | Local document storage path |
| `NODE_ENV` | `development` | Environment |

## Seed Credentials

All seed users share the password: **`Password123!`**

| Email | Role |
|-------|------|
| `admin@legal.local` | LEGAL_ADMIN |
| `manager@legal.local` | LEGAL_MANAGER |
| `counsel@legal.local` | LEGAL_COUNSEL |
| `counsel2@legal.local` | LEGAL_COUNSEL |
| `viewer@legal.local` | VIEWER |

Seed data includes 3 cases, 2 contracts, 2 notices (with auto-deadlines), deadlines, reminders, tasks, documents, discussions, financial records, and sample activity logs.

## Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"counsel@legal.local","password":"Password123!"}'

# Current user
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

Flow: `POST /auth/login` returns a JWT; send `Authorization: Bearer <token>` on protected routes. Default TTL is 8 hours.

## API Overview

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/auth` | `POST /login`, `GET /me` |
| Users | `/users` | CRUD (admin/manager) |
| Dashboard | `/dashboard` | `GET /summary` |
| Cases | `/cases` | CRUD, reassign, parties, `GET /:id/timeline` |
| Contracts | `/contracts` | CRUD, reassign |
| Notices | `/notices` | CRUD, reassign (auto-creates deadline) |
| Deadlines | `/deadlines` | CRUD + `view=upcoming\|overdue\|today\|assigned-to-me` |
| Reminders | `/reminders` | CRUD, `POST /process-due`, view filters |
| Tasks | `/tasks` | CRUD |
| Documents | `/documents` | Upload, download, list, soft-delete |
| Discussions | `/discussions` | CRUD on cases/contracts/notices |
| Financial Records | `/financial-records` | CRUD on cases/contracts |
| Activity Logs | `/activity-logs` | Read-only audit trail |
| Offboarding | `/offboarding` | `POST /transfer` (bulk ownership transfer) |
| Health | `/health` | `GET` (no auth) |

### Response Shapes

- **List:** `{ data: T[], meta: { page, limit, total } }`
- **Single:** `{ data: T }`
- **Error:** `{ statusCode, message, errors? }`

List endpoints support `page` and `limit` (default: 1 and 20).

## API Reference

**Base URL:** `/api/v1` · **Auth:** Bearer JWT (except `/health`)

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Returns JWT access token |
| GET | `/me` | JWT | Current user profile |

### Dashboard — `/dashboard`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/summary` | JWT | Open cases, active contracts, pending notices, overdue/today deadlines, my open tasks |

### Cases — `/cases`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List cases (scoped by role) |
| POST | `/` | JWT | Create case |
| GET | `/:id` | JWT | Get case by ID |
| PATCH | `/:id` | JWT | Update case |
| DELETE | `/:id` | JWT | Soft-delete case |
| POST | `/:id/reassign` | Admin/Manager | Reassign owner |
| GET | `/:id/timeline` | JWT | Activity log timeline for the case |
| GET | `/:id/parties` | JWT | List parties |
| POST | `/:id/parties` | JWT | Add party |
| PATCH | `/:id/parties/:partyId` | JWT | Update party |
| DELETE | `/:id/parties/:partyId` | JWT | Remove party |

### Users — `/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin/Manager | List users (`?role=&isActive=`) |
| POST | `/` | Admin/Manager | Create user account |
| GET | `/:id` | Admin/Manager | Get user detail |
| PATCH | `/:id` | Admin/Manager | Update fullName, role, or isActive |

### Contracts — `/contracts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List contracts |
| POST | `/` | JWT | Create contract |
| GET | `/:id` | JWT | Get contract |
| PATCH | `/:id` | JWT | Update contract |
| DELETE | `/:id` | JWT | Soft-delete |
| POST | `/:id/reassign` | Admin/Manager | Reassign owner |

### Notices — `/notices`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List notices |
| POST | `/` | JWT | Create notice (+ auto-deadline) |
| GET | `/:id` | JWT | Get notice |
| PATCH | `/:id` | JWT | Update notice |
| DELETE | `/:id` | JWT | Soft-delete |
| POST | `/:id/reassign` | Admin/Manager | Reassign owner |

### Deadlines — `/deadlines`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (`?view=upcoming\|overdue\|today\|assigned-to-me`) |
| POST | `/` | JWT | Create deadline |
| GET | `/:id` | JWT | Get deadline |
| PATCH | `/:id` | JWT | Update deadline |
| DELETE | `/:id` | JWT | Cancel deadline |

### Reminders — `/reminders`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (`?view=upcoming\|due\|sent\|assigned-to-me`) |
| POST | `/` | Counsel+ | Create reminder for a deadline |
| POST | `/process-due` | Admin/Manager | Mark due pending reminders as sent |
| GET | `/:id` | JWT | Get reminder |
| PATCH | `/:id` | Counsel+ | Update remindAt, message, or dismiss |

### Tasks — `/tasks`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List tasks |
| POST | `/` | JWT | Create task |
| GET | `/:id` | JWT | Get task |
| PATCH | `/:id` | JWT | Update task |
| DELETE | `/:id` | JWT | Soft-delete / cancel |

### Documents — `/documents`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (`?caseId=&contractId=&noticeId=`) |
| POST | `/` | JWT | Upload (multipart/form-data) |
| GET | `/:id` | JWT | Get metadata |
| GET | `/:id/download` | JWT | Download file |
| DELETE | `/:id` | JWT | Soft-delete |

### Discussions — `/discussions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (`?caseId=&contractId=&noticeId=`) |
| POST | `/` | Counsel+ | Create discussion on a matter |
| GET | `/:id` | JWT | Get discussion |
| PATCH | `/:id` | Counsel+ | Update content (author only) |
| DELETE | `/:id` | Counsel+ | Soft-delete (author or admin/manager) |

### Financial Records — `/financial-records`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List (`?caseId=&contractId=&type=`) |
| POST | `/` | Counsel+ | Create record on case or contract |
| GET | `/:id` | JWT | Get record |
| PATCH | `/:id` | Counsel+ | Update record |
| DELETE | `/:id` | Counsel+ | Soft-delete |

### Activity Logs — `/activity-logs`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List audit entries (`?entityType=&entityId=&actorId=`) |

Use `entityType` + `entityId` to build a case/contract/notice timeline.

### Offboarding — `/offboarding`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/transfer` | Admin/Manager | Bulk transfer `{ fromUserId, toUserId }` |

### Example requests

```bash
# Overdue deadlines
curl "http://localhost:3000/api/v1/deadlines?view=overdue" \
  -H "Authorization: Bearer <token>"

# Bulk offboarding
curl -X POST http://localhost:3000/api/v1/offboarding/transfer \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId":"<uuid>","toUserId":"<uuid>"}'
```

Full interactive docs: **Swagger UI** at `/api/docs`.

## Roles & Authorization

| Role | Access |
|------|--------|
| `LEGAL_ADMIN` | Full access including offboarding |
| `LEGAL_MANAGER` | Full access including offboarding |
| `LEGAL_COUNSEL` | View/edit own matters; assigned tasks/deadlines |
| `VIEWER` | Read-only across all records |

### Permission matrix

| Action | Admin/Manager | Counsel | Viewer |
|--------|:-------------:|:-------:|:------:|
| View all cases/contracts/notices | ✅ | Own only | ✅ |
| Create/edit cases/contracts/notices | ✅ | Own only | ❌ |
| Reassign ownership | ✅ | ❌ | ❌ |
| View all deadlines | ✅ | Own matters + assigned | ✅ |
| Edit deadline | ✅ | Owner or assignee | ❌ |
| View all tasks | ✅ | Own matters + assigned + created | ✅ |
| Upload document | ✅ | ✅ (on accessible matter) | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Bulk offboarding | ✅ | ❌ | ❌ |
| View activity logs | All | Own actions only | All |

Authorization is enforced in use cases via `AccessControlService`, not only controller guards.

## Architecture

Four layers per feature module:

```
modules/<feature>/
├── domain/           # Types, enums, pure rules
├── application/      # Use cases — orchestration, auth, logging
├── infrastructure/   # Prisma repos, file adapters
└── presentation/     # Controllers, DTOs, Swagger
```

**Key decisions:**

| Decision | Choice |
|----------|--------|
| Repositories | Concrete Prisma repos (no interfaces); `FileStoragePort` for files only |
| Activity logging | Explicit `ActivityLogService.log()` in each use case |
| Dashboard | Live `count()` queries — no cache or snapshot table |
| Multi-aggregate writes | Direct `PrismaService` in notice create + bulk offboarding (transactional) |

**Request lifecycle:**

```
HTTP → JwtAuthGuard → RolesGuard → ValidationPipe → Controller → Use Case
  → AccessControlService → Repository/Prisma → ActivityLogService (mutations)
```

## Data Model

```
User ── owns → LegalCase, Contract, LegalNotice
     ── assigned → Task, Deadline
     ── uploaded → Document

LegalCase ── parties, deadlines, tasks, documents, related notices
Contract  ── deadlines, tasks, documents, related notices
LegalNotice ── auto-linked deadline, tasks, documents
```

| Table | Soft delete |
|-------|-------------|
| `legal_cases`, `contracts`, `legal_notices`, `tasks`, `documents`, `discussions`, `financial_records` | `deletedAt` |
| `deadlines`, `activity_logs`, `users`, `reminders` | — |

**Reference codes:** `CASE-YYYY-NNNNN`, `CTR-YYYY-NNNNN`, `NTC-YYYY-NNNNN`

## Business Rules

- **Soft delete** — deleted records excluded from lists and dashboard counts
- **Notice intake** — creating a notice atomically creates a linked response deadline in the same transaction
- **Deadline views** — `upcoming`, `overdue`, `today`, `assigned-to-me` (today uses `APP_TIMEZONE`)
- **Documents** — max 20 MB; PDF, DOC, DOCX, PNG, JPEG; access inherits from parent matter
- **Offboarding** — single transaction transfers case/contract/notice ownership and task/deadline assignees
- **Owner on create** — counsel becomes default owner; admin/manager may assign a different owner

## Persian Date Handling

Jalali formatting in API responses for notices, deadlines, tasks, contracts, cases, documents, discussions, financial records, and reminders:

| Capability | Implementation |
|------------|----------------|
| Timezone-aware "today" | `APP_TIMEZONE` + `todayInTimezone()` |
| Jalali date fields | `*Persian` suffix on date/datetime fields |
| Input | Gregorian ISO dates (`YYYY-MM-DD`) |

Utility: `src/shared/utils/persian-date.util.ts`

## Activity Log & Audit Trail

Logged actions: `CREATED`, `UPDATED`, `DELETED`, `STATUS_CHANGED`, `REASSIGNED`, `DOCUMENT_UPLOADED`, `DEADLINE_COMPLETED`, `OWNERSHIP_TRANSFERRED`, `REMINDER_SENT`.

Every mutation writes an entry with actor, timestamp, and JSON metadata. Counsel sees only their own actions; admin/manager/viewer see all.

## Testing

```bash
npm test                  # Unit (54 suites, 469 tests)
npm run test:integration  # Repos (12 suites, 101 tests; requires DATABASE_URL)
npm run test:e2e          # HTTP API (14 suites, 221 tests; requires DATABASE_URL)
npm run test:all          # All layers (791 tests)
npm run build
npm run prisma:validate
```

Coverage includes every API endpoint across unit, integration, and e2e layers: auth, users, cases (including timeline and parties), contracts, notices, deadlines, reminders, tasks, documents, discussions, financial records, activity logs, dashboard, and offboarding.

## Project Structure

```
src/
├── config/           # Env validation, constants
├── prisma/           # PrismaModule + PrismaService
├── shared/           # AccessControl, ActivityLog, guards, utils
└── modules/          # auth, users, cases, contracts, notices, deadlines,
                      # reminders, tasks, documents, discussions,
                      # financial-records, activity-log, dashboard, offboarding
    ├── domain/
    ├── application/
    ├── infrastructure/
    └── presentation/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled app |
| `npx prisma db seed` | Seed demo data |
| `npm run prisma:migrate:dev` | Create/apply migrations (dev) |

## Feature Coverage

All core product requirements are implemented:

| Capability | Status |
|------------|--------|
| Authentication & 4 roles | ✅ |
| User management API (admin/manager) | ✅ |
| Case management (CRUD, parties, timeline, documents) | ✅ |
| Party update & delete | ✅ |
| Contract management (CRUD, dates, key terms, documents) | ✅ |
| Notice intake with auto-deadline | ✅ |
| Deadline tracking (4 views) | ✅ |
| Deadline reminders (CRUD + process-due) | ✅ |
| Tasks linked to legal matters | ✅ |
| Documents (upload, metadata, access control) | ✅ |
| Discussions on cases/contracts/notices | ✅ |
| Financial records on cases/contracts | ✅ |
| Activity log / audit trail | ✅ |
| Permission-aware dashboard | ✅ |
| Reassignment + bulk offboarding | ✅ |
| Persian dates (all entities with dates) | ✅ |
| Seed data, migrations, tests, Docker setup | ✅ |

The project is API-first; Swagger at `/api/docs` serves as the interactive client.

## License

UNLICENSED — personal portfolio project.
