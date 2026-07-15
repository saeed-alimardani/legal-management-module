# Legal Management Module

Internal legal operations platform for managing cases, contracts, notices, deadlines, reminders, tasks, documents, discussions, and financial records. **Backend:** NestJS, PostgreSQL, Prisma, JWT. **Frontend:** Next.js App Router.

> **Development notes:** [AI_USAGE.md](./AI_USAGE.md) — how AI tools were used in this project.

## Table of Contents

- [Stack](#stack)
- [Prerequisites](#prerequisites)
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
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [License](#license)

## Stack

- **Backend:** NestJS 10, PostgreSQL 16, Prisma ORM, JWT (Passport), Pino, Swagger
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Architecture:** Lightweight DDD + Hexagonal (backend, 4 layers per module)

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 16 (if running locally without Docker)

## Quick Start

### Docker — daily development (recommended)

Uses **bind mounts** for your source code and uploads, and **named volumes** for `node_modules` so `npm ci` runs only once (or when `package-lock.json` changes). No image rebuild on every start.

```powershell
cd legal-management-module

Copy-Item backend\.env.example backend\.env -ErrorAction SilentlyContinue
Copy-Item frontend\.env.example frontend\.env.local -ErrorAction SilentlyContinue

docker compose -f docker-compose.dev.yml up

# First time only (separate terminal, after backend is up)
docker compose -f docker-compose.dev.yml exec backend npx prisma db seed
```

| What | Where it lives |
|------|----------------|
| Source code | Your local `backend/` and `frontend/` folders (live edits) |
| `node_modules` | Docker volumes `backend_node_modules`, `frontend_node_modules` (persist between restarts) |
| Uploads | Local `backend/uploads/` |
| Database | Docker volume `postgres_data` |

Stop: `Ctrl+C` or `docker compose -f docker-compose.dev.yml down`  
Reset deps volumes (if corrupted): `docker compose -f docker-compose.dev.yml down -v`

### Docker — production-style build

Builds optimized images. Use for deployment smoke tests, not daily coding.

```powershell
docker compose up --build -d
docker compose exec backend npx prisma db seed   # first time only
```

First build takes 5–10 minutes. `.dockerignore` files prevent sending 500MB+ of `node_modules` to Docker.

Migrations run automatically when the backend container starts. Seed data must be applied manually once.

| Resource | URL |
|----------|-----|
| Frontend | `http://localhost:3001` |
| API | `http://localhost:3000/api/v1` |
| Swagger | `http://localhost:3000/api/docs` |
| Health | `GET /health` |

### Local development

```bash
docker compose up postgres -d

# Backend
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://legal:legal@localhost:5432/legal_management` | PostgreSQL connection |
| `JWT_SECRET` | `change-me-to-a-long-random-secret` | JWT signing secret (32+ chars) |
| `JWT_EXPIRES_IN` | `8h` | Token TTL |
| `PORT` | `3000` | HTTP port |
| `APP_TIMEZONE` | `Asia/Tehran` | Timezone for today/overdue deadline logic |
| `UPLOAD_DIR` | `./uploads` | Local document storage path |
| `FRONTEND_URL` | `http://localhost:3001` | CORS origin for the Next.js app |
| `NODE_ENV` | `development` | Environment |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api/v1` | Frontend API base URL (in `frontend/.env.local`) |

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
| `LEGAL_MANAGER` | Full access excluding offboarding and user manager and logs |
| `LEGAL_COUNSEL` | View owned matters; add/edit assigned deadlines/reminders |
| `VIEWER` | Read-only on owned matters |

### Permission matrix

| Action | Admin/Manager | Counsel | Viewer |
|--------|:-------------:|:-------:|:------:|
| View all cases/contracts/notices | ✅ | Owned only | Owned only |
| Create/edit cases/contracts/notices | ✅ | Own only | ❌ |
| Reassign ownership | ✅ | ❌ | ❌ |
| View all deadlines | ✅ | Own matters + assigned | Own matters + assigned |
| Edit deadline | ✅ | Owner or assignee | ❌ |
| View all tasks | ✅ | Own matters + assigned + created | Own matters + assigned + created |
| Upload document | ✅ | ✅ (on accessible matter) | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Bulk offboarding | ✅ | ❌ | ❌ |
| View activity logs | All | Own actions only | All |
| Dashboard "My Work" | Owned matters + assigned deadlines/tasks | Owned matters + assigned deadlines/tasks | Owned matters + assigned deadlines/tasks |
| Dashboard "All" | ✅ | ❌ | ❌ |

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
cd backend
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
legal-management-module/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── config/
│   │   ├── prisma/
│   │   ├── shared/
│   │   └── modules/
│   ├── prisma/
│   └── test/
├── frontend/             # Next.js UI
│   └── src/app/
└── docker-compose.yml
```

## Scripts

Run from `backend/`:

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled app |
| `npm run lint` | ESLint with auto-fix |
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
| Next.js frontend (full module coverage) | ✅ |

Swagger at `/api/docs` documents the API; the Next.js app at `:3001` is the primary UI.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Docker build takes 20+ minutes / appears stuck | Use `docker compose -f docker-compose.dev.yml up` instead of `up --build`. Ensure `.dockerignore` exists in `backend/` and `frontend/` |
| `npm ci` runs every Docker start | Use `docker-compose.dev.yml` — deps are stored in named volumes and skipped when unchanged |
| `ECONNREFUSED` on port 5432 | Start Postgres: `docker compose up postgres -d`, or check `DATABASE_URL` |
| `JWT_SECRET` validation error | Use a secret of at least 32 characters in `.env` |
| Empty lists after first Docker start | Run `docker compose exec backend npx prisma db seed` |
| Integration/e2e tests fail | Ensure Postgres is running and `DATABASE_URL` in `.env` is correct |
| Port 3000 already in use | Change `PORT` in `.env` or stop the conflicting process |

## Future Improvements

Out of scope for the current MVP but natural next steps:

- Reminder delivery (email or push) instead of marking reminders as sent only
- Cloud object storage adapter (e.g. S3) alongside local file storage
- CI pipeline for build, lint, and test on every push

## License

UNLICENSED — personal portfolio project.
