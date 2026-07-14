# Legal Management Module

Internal legal operations API for managing cases, contracts, notices, deadlines, tasks, and documents. Built with NestJS, PostgreSQL, Prisma, and JWT authentication.

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

## Quick Start (Docker)

```bash
# 1. Clone and enter the project
cd legal-management-module

# 2. Copy environment file
cp .env.example .env

# 3. Start Postgres + app
docker compose up --build

# 4. In another terminal, run migrations and seed (first time)
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

The API is available at `http://localhost:3000`.

- Health: `GET /health`
- Swagger: `http://localhost:3000/api/docs`
- API base: `/api/v1`

## Local Development (without Docker app container)

```bash
# Start Postgres only
docker compose up postgres -d

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Generate Prisma client, migrate, seed
npm run prisma:generate
npx prisma migrate dev
npx prisma db seed

# Start dev server
npm run start:dev
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

Seed data includes 3 cases, 2 contracts, 2 notices (with auto-deadlines), deadlines, tasks, documents, and sample activity logs.

## Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"counsel@legal.local","password":"Password123!"}'

# Use returned accessToken in subsequent requests
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

## API Overview

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Auth | `/auth` | `POST /login`, `GET /me` |
| Dashboard | `/dashboard` | `GET /summary` |
| Cases | `/cases` | CRUD, reassign, parties |
| Contracts | `/contracts` | CRUD, reassign |
| Notices | `/notices` | CRUD, reassign (auto-creates deadline) |
| Deadlines | `/deadlines` | CRUD + `view=upcoming\|overdue\|today\|assigned-to-me` |
| Tasks | `/tasks` | CRUD |
| Documents | `/documents` | Upload, download, list, soft-delete |
| Activity Logs | `/activity-logs` | Read-only audit trail |
| Offboarding | `/offboarding` | `POST /transfer` (bulk ownership transfer) |
| Health | `/health` | `GET` (no auth) |

### Response Shapes

- **List:** `{ data: T[], meta: { page, limit, total } }`
- **Single:** `{ data: T }`
- **Error:** `{ statusCode, message, errors? }`

## Roles & Authorization

| Role | Access |
|------|--------|
| `LEGAL_ADMIN` | Full access including offboarding |
| `LEGAL_MANAGER` | Full access including offboarding |
| `LEGAL_COUNSEL` | View/edit own matters; assigned tasks/deadlines |
| `VIEWER` | Read-only across all records |

Authorization is enforced in use cases via `AccessControlService`, not only controller guards.

## Testing

```bash
# Unit tests
npm test

# Integration tests (requires DATABASE_URL)
npm run test:integration

# E2E tests (requires DATABASE_URL)
npm run test:e2e

# All tests
npm run test:all

# Build
npm run build

# Prisma validation
npm run prisma:validate
```

## Project Structure

```
src/
├── config/           # Env validation, constants
├── prisma/           # PrismaModule + PrismaService
├── shared/           # AccessControl, ActivityLog, guards, utils
└── modules/          # Feature modules (auth, cases, contracts, ...)
    ├── domain/       # Types, enums, pure rules
    ├── application/  # Use cases
    ├── infrastructure/ # Prisma repos, file adapter
    └── presentation/ # Controllers, DTOs
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled app |
| `npx prisma db seed` | Seed demo data |
| `npm run prisma:migrate:dev` | Create/apply migrations (dev) |

## License

UNLICENSED — interview assignment project.
