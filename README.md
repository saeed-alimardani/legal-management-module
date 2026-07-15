# Legal Management Module

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Internal legal operations platform for managing cases, contracts, notices, deadlines, reminders, tasks, documents, discussions, financial records, access control, activity logs, and offboarding.

Built as an **AI-assisted coding interview assignment** — a secure, auditable workspace that acts as both a system of record for legal information and a system of deadlines for critical legal obligations, with Persian (Jalali) date support where relevant.

> **AI workflow documentation:** [AI_USAGE.md](./AI_USAGE.md) — tools used, prompts, mistakes corrected, and personal architectural decisions.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Demo Credentials](#demo-credentials)
- [Application URLs](#application-urls)
- [Authentication](#authentication)
- [API Overview](#api-overview)
- [Roles & Authorization](#roles--authorization)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Business Rules](#business-rules)
- [Persian Date Handling](#persian-date-handling)
- [Testing](#testing)
- [Scripts](#scripts)
- [Assignment Requirements Checklist](#assignment-requirements-checklist)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## Features

| Area | Capabilities |
|------|--------------|
| **Authentication** | JWT login, 4 roles with enforced permission boundaries |
| **Cases** | CRUD, parties, timeline, documents, reference codes, soft delete |
| **Contracts** | CRUD, counterparty, dates, key terms, documents, reassignment |
| **Notices** | Intake tracking with automatic response-deadline creation |
| **Deadlines** | Upcoming, overdue, today, and assigned-to-me views |
| **Reminders** | CRUD linked to deadlines, process-due batch action |
| **Tasks** | Simple task management linked to legal matters |
| **Documents** | Upload, metadata, download, access control (20 MB, common MIME types) |
| **Discussions** | Threaded notes on cases, contracts, and notices |
| **Financial records** | Income/expense tracking on cases and contracts |
| **Activity log** | Audit trail for create, update, delete, reassign, status changes |
| **Dashboard** | Permission-aware summary of open work and deadlines |
| **Offboarding** | Bulk ownership transfer between users |
| **UI** | Full Next.js frontend covering all API modules |
| **DevOps** | Docker Compose (dev + production), migrations, seed data, 700+ tests |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | NestJS 10, PostgreSQL 16, Prisma ORM, JWT (Passport), Pino, Swagger |
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **Architecture** | Lightweight DDD + Hexagonal (4 layers per backend module) |
| **Testing** | Jest, Supertest — unit, integration, and e2e |
| **Containerization** | Docker, Docker Compose |

---

## Repository Layout

```
legal-management-module/
├── backend/                  # NestJS REST API
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   ├── migrations/       # SQL migrations
│   │   └── seed.ts           # Demo seed data
│   ├── scripts/              # Docker dev entrypoint
│   ├── src/
│   │   ├── config/           # Env validation, constants
│   │   ├── modules/          # Feature modules (auth, cases, …)
│   │   ├── prisma/           # PrismaService
│   │   └── shared/           # Access control, activity log, guards
│   ├── test/                 # Unit, integration, e2e tests
│   ├── uploads/              # Local document storage (gitignored contents)
│   ├── .env.example
│   └── Dockerfile
├── frontend/                 # Next.js UI
│   ├── src/app/              # App Router pages
│   ├── src/components/       # Shared UI components
│   ├── src/lib/              # API client, auth, RBAC helpers
│   ├── .env.example
│   └── Dockerfile
├── docker-compose.yml        # Production-style stack
├── docker-compose.dev.yml    # Development stack (bind mounts + hot reload)
├── AI_USAGE.md               # Required AI workflow documentation
├── LICENSE                   # MIT
└── README.md
```

---

## Prerequisites

- **Node.js** 20+
- **Docker** & **Docker Compose** (recommended)
- **PostgreSQL** 16 (only if running the database locally without Docker)

---

## Quick Start

### Option A — Docker development (recommended for daily coding)

Uses bind mounts for source code and named volumes for `node_modules`. Hot reload on both backend and frontend.

```powershell
# Clone and enter the repo
git clone <your-repo-url>
cd legal-management-module

# Copy environment templates
Copy-Item backend\.env.example backend\.env -ErrorAction SilentlyContinue
Copy-Item frontend\.env.example frontend\.env.local -ErrorAction SilentlyContinue

# Start Postgres + backend + frontend
docker compose -f docker-compose.dev.yml up

# First time only — seed demo data (separate terminal, after backend is healthy)
docker compose -f docker-compose.dev.yml exec backend npx prisma db seed
```

| Resource | Location |
|----------|----------|
| Source code | Local `backend/` and `frontend/` (live edits) |
| `node_modules` | Docker volumes `backend_node_modules`, `frontend_node_modules` |
| Uploads | Local `backend/uploads/` |
| Database | Docker volume `postgres_data` |

Stop with `Ctrl+C` or `docker compose -f docker-compose.dev.yml down`.

### Option B — Docker production-style build

Builds optimized images. Use for deployment smoke tests.

```powershell
docker compose up --build -d

# First time only
docker compose exec backend npx prisma db seed
```

Migrations run automatically when the backend container starts. Change `JWT_SECRET` in `docker-compose.yml` before any real deployment.

First build may take 5–10 minutes. `.dockerignore` files keep build context small.

### Option C — Local development (no app containers)

```bash
# Start only Postgres
docker compose up postgres -d

# Backend
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
npm run prisma:generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
npm run dev
```

---

## Environment Variables

Copy the example files before starting:

| File | Purpose |
|------|---------|
| `backend/.env.example` → `backend/.env` | Backend configuration |
| `frontend/.env.example` → `frontend/.env.local` | Frontend API URL |

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://legal:legal@localhost:5432/legal_management` | PostgreSQL connection string |
| `JWT_SECRET` | `change-me-to-a-long-random-secret` | JWT signing secret (16+ chars) |
| `JWT_EXPIRES_IN` | `8h` | Token time-to-live |
| `PORT` | `3000` | Backend HTTP port |
| `APP_TIMEZONE` | `Asia/Tehran` | Timezone for today/overdue deadline logic |
| `UPLOAD_DIR` | `./uploads` | Local document storage path |
| `FRONTEND_URL` | `http://localhost:3001` | CORS origin for the Next.js app |
| `NODE_ENV` | `development` | Runtime environment |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api/v1` | Frontend API base URL |

Never commit `.env` or `.env.local` files. Templates are provided as `.env.example`.

---

## Demo Credentials

All seed users share the password: **`Password123!`**

| Email | Role |
|-------|------|
| `admin@legal.local` | LEGAL_ADMIN |
| `manager@legal.local` | LEGAL_MANAGER |
| `counsel@legal.local` | LEGAL_COUNSEL |
| `counsel2@legal.local` | LEGAL_COUNSEL |
| `viewer@legal.local` | VIEWER |

Seed data includes sample cases, contracts, notices (with auto-deadlines), deadlines, reminders, tasks, documents, discussions, financial records, and activity logs.

---

## Application URLs

| Resource | URL |
|----------|-----|
| **Frontend (UI)** | http://localhost:3001 |
| **API base** | http://localhost:3000/api/v1 |
| **Swagger docs** | http://localhost:3000/api/docs |
| **Health check** | http://localhost:3000/health |

---

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

Send `Authorization: Bearer <token>` on all protected routes. Default token TTL is 8 hours.

---

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

**Response shapes**

- List: `{ data: T[], meta: { page, limit, total } }`
- Single: `{ data: T }`
- Error: `{ statusCode, message, errors? }`

Interactive API documentation is available at **Swagger UI** (`/api/docs`).

---

## Roles & Authorization

| Role | Access |
|------|--------|
| `LEGAL_ADMIN` | Full access including offboarding and user management |
| `LEGAL_MANAGER` | Full access excluding offboarding |
| `LEGAL_COUNSEL` | View/edit owned matters; manage assigned deadlines and reminders |
| `VIEWER` | Read-only on owned matters |

Authorization is enforced in use cases via `AccessControlService`, not only controller guards.

---

## Architecture

Four layers per backend feature module:

```
modules/<feature>/
├── domain/           # Types, enums, pure rules
├── application/      # Use cases — orchestration, auth, logging
├── infrastructure/   # Prisma repos, file adapters
└── presentation/     # Controllers, DTOs, Swagger
```

**Key decisions**

| Decision | Choice |
|----------|--------|
| Repositories | Concrete Prisma repos; `FileStoragePort` for filesystem only |
| Activity logging | Explicit `ActivityLogService.log()` in each use case |
| Dashboard | Live `count()` queries — no cache or snapshot table |
| Multi-aggregate writes | Direct `PrismaService` in notice create + bulk offboarding (transactional) |

**Request lifecycle**

```
HTTP → JwtAuthGuard → RolesGuard → ValidationPipe → Controller → Use Case
  → AccessControlService → Repository/Prisma → ActivityLogService (mutations)
```

---

## Data Model

```
User ── owns → LegalCase, Contract, LegalNotice
     ── assigned → Task, Deadline
     ── uploaded → Document

LegalCase ── parties, deadlines, tasks, documents, related notices
Contract  ── deadlines, tasks, documents, related notices
LegalNotice ── auto-linked deadline, tasks, documents
```

**Reference codes:** `CASE-YYYY-NNNNN`, `CTR-YYYY-NNNNN`, `NTC-YYYY-NNNNN`

Soft delete (`deletedAt`) applies to cases, contracts, notices, tasks, documents, discussions, and financial records.

Schema and migrations live in `backend/prisma/`.

---

## Business Rules

- **Soft delete** — deleted records excluded from lists and dashboard counts
- **Notice intake** — creating a notice atomically creates a linked response deadline
- **Deadline views** — `upcoming`, `overdue`, `today`, `assigned-to-me` (today uses `APP_TIMEZONE`)
- **Documents** — max 20 MB; PDF, DOC, DOCX, PNG, JPEG; access inherits from parent matter
- **Offboarding** — single transaction transfers case/contract/notice ownership and task/deadline assignees
- **Owner on create** — counsel becomes default owner; admin/manager may assign a different owner

---

## Persian Date Handling

Jalali formatting in API responses for entities with dates. Clients send Gregorian ISO dates (`YYYY-MM-DD`); responses include `*Persian` suffix fields. Timezone-aware "today" uses `APP_TIMEZONE` (default `Asia/Tehran`).

Utility: `backend/src/shared/utils/persian-date.util.ts`

---

## Testing

```bash
cd backend

npm test                  # Unit tests
npm run test:integration  # Repository tests (requires DATABASE_URL + Postgres)
npm run test:e2e          # HTTP API tests (requires DATABASE_URL + Postgres)
npm run test:all          # All layers
npm run build
npm run prisma:validate
```

Integration and e2e tests require a running PostgreSQL instance with `DATABASE_URL` set in `backend/.env`.

```bash
cd frontend
npm run build             # Type-check and production build
```

---

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
| `npm run prisma:validate` | Validate Prisma schema |

Run from `frontend/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |

---

## Assignment Requirements Checklist

This project satisfies the **AI Coding Interview Assignment** deliverables and core features:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Authentication & 4 roles | ✅ | Admin, Manager, Counsel, Viewer |
| Legal case management | ✅ | Parties, timeline, documents, reference codes |
| Contract management | ✅ | Dates, counterparty, key terms, documents |
| Legal notice management | ✅ | Intake + auto response deadline |
| Deadline & reminder management | ✅ | 4 deadline views + reminder CRUD |
| Tasks & collaboration | ✅ | Linked to cases, contracts, notices |
| Documents with access control | ✅ | Upload, metadata, role-based access |
| Activity log / audit trail | ✅ | All critical mutations logged |
| Dashboard | ✅ | Permission-aware summary |
| Reassignment & offboarding | ✅ | Single + bulk transfer |
| Persian date handling | ✅ | Jalali output, timezone-aware today |
| UI or API-first | ✅ | Full Next.js UI + REST API |
| Setup instructions | ✅ | This README |
| Seed data | ✅ | `backend/prisma/seed.ts` |
| Database migrations | ✅ | `backend/prisma/migrations/` |
| Tests | ✅ | Unit, integration, e2e |
| AI_USAGE.md | ✅ | Tools, workflow, prompts, mistakes, decisions |

See [AI_USAGE.md](./AI_USAGE.md) for the required AI workflow documentation.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Docker build is slow | Use `docker compose -f docker-compose.dev.yml up` for daily dev |
| `npm ci` runs every Docker start | Dev compose stores deps in named volumes — only reinstalls when lockfile changes |
| `ECONNREFUSED` on port 5432 | Start Postgres: `docker compose up postgres -d`, or check `DATABASE_URL` |
| `JWT_SECRET` validation error | Use a secret of at least 16 characters in `.env` |
| Empty lists after first Docker start | Run `docker compose exec backend npx prisma db seed` |
| Integration/e2e tests fail | Ensure Postgres is running and `DATABASE_URL` in `.env` is correct |
| Port 3000 or 3001 in use | Change `PORT` in env files or stop the conflicting process |
| Frontend cannot reach API in Docker | Ensure `NEXT_PUBLIC_API_URL` points to `http://localhost:3000/api/v1` (browser-side URL) |

---

## Future Improvements

Natural next steps beyond the current MVP:

- Reminder delivery (email or push) instead of marking reminders as sent only
- Cloud object storage adapter (e.g. S3) alongside local file storage
- CI pipeline for build, lint, and test on every push

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 Saeed Alimardani
