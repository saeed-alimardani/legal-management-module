-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LEGAL_ADMIN', 'LEGAL_MANAGER', 'LEGAL_COUNSEL', 'VIEWER');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('LITIGATION', 'ARBITRATION', 'REGULATORY', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('PLAINTIFF', 'DEFENDANT', 'THIRD_PARTY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('NDA', 'MSA', 'EMPLOYMENT', 'VENDOR', 'LEASE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'RESPONDED', 'CLOSED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'FILING', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'REASSIGNED', 'DOCUMENT_UPLOADED', 'DEADLINE_COMPLETED', 'OWNERSHIP_TRANSFERRED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'CASE', 'CONTRACT', 'NOTICE', 'DEADLINE', 'TASK', 'DOCUMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_cases" (
    "id" UUID NOT NULL,
    "reference_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "type" "CaseType" NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "priority" "Priority" NOT NULL,
    "owner_id" UUID NOT NULL,
    "description" TEXT,
    "opened_date" DATE,
    "closed_date" DATE,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_parties" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "party_type" "PartyType" NOT NULL,
    "contact_info" VARCHAR(500),
    "notes" TEXT,

    CONSTRAINT "case_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "reference_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL,
    "owner_id" UUID NOT NULL,
    "counterparty_name" VARCHAR(255) NOT NULL,
    "effective_date" DATE,
    "expiration_date" DATE,
    "renewal_date" DATE,
    "key_terms" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_notices" (
    "id" UUID NOT NULL,
    "reference_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "sender" VARCHAR(255) NOT NULL,
    "received_date" DATE NOT NULL,
    "response_deadline" DATE NOT NULL,
    "status" "NoticeStatus" NOT NULL,
    "owner_id" UUID NOT NULL,
    "description" TEXT,
    "related_case_id" UUID,
    "related_contract_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "DeadlineStatus" NOT NULL,
    "assignee_id" UUID,
    "case_id" UUID,
    "contract_id" UUID,
    "notice_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL,
    "assignee_id" UUID NOT NULL,
    "due_date" DATE,
    "case_id" UUID,
    "contract_id" UUID,
    "notice_id" UUID,
    "created_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "description" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "case_id" UUID,
    "contract_id" UUID,
    "notice_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "legal_cases_reference_code_key" ON "legal_cases"("reference_code");

-- CreateIndex
CREATE INDEX "legal_cases_owner_id_idx" ON "legal_cases"("owner_id");

-- CreateIndex
CREATE INDEX "legal_cases_status_idx" ON "legal_cases"("status");

-- CreateIndex
CREATE INDEX "legal_cases_deleted_at_idx" ON "legal_cases"("deleted_at");

-- CreateIndex
CREATE INDEX "case_parties_case_id_idx" ON "case_parties"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_reference_code_key" ON "contracts"("reference_code");

-- CreateIndex
CREATE INDEX "contracts_owner_id_idx" ON "contracts"("owner_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_expiration_date_idx" ON "contracts"("expiration_date");

-- CreateIndex
CREATE INDEX "contracts_deleted_at_idx" ON "contracts"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "legal_notices_reference_code_key" ON "legal_notices"("reference_code");

-- CreateIndex
CREATE INDEX "legal_notices_owner_id_idx" ON "legal_notices"("owner_id");

-- CreateIndex
CREATE INDEX "legal_notices_response_deadline_idx" ON "legal_notices"("response_deadline");

-- CreateIndex
CREATE INDEX "legal_notices_status_idx" ON "legal_notices"("status");

-- CreateIndex
CREATE INDEX "legal_notices_deleted_at_idx" ON "legal_notices"("deleted_at");

-- CreateIndex
CREATE INDEX "deadlines_due_date_status_idx" ON "deadlines"("due_date", "status");

-- CreateIndex
CREATE INDEX "deadlines_assignee_id_due_date_status_idx" ON "deadlines"("assignee_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "deadlines_case_id_idx" ON "deadlines"("case_id");

-- CreateIndex
CREATE INDEX "deadlines_contract_id_idx" ON "deadlines"("contract_id");

-- CreateIndex
CREATE INDEX "deadlines_notice_id_idx" ON "deadlines"("notice_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_idx" ON "tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "tasks_case_id_idx" ON "tasks"("case_id");

-- CreateIndex
CREATE INDEX "tasks_contract_id_idx" ON "tasks"("contract_id");

-- CreateIndex
CREATE INDEX "tasks_notice_id_idx" ON "tasks"("notice_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_case_id_idx" ON "documents"("case_id");

-- CreateIndex
CREATE INDEX "documents_contract_id_idx" ON "documents"("contract_id");

-- CreateIndex
CREATE INDEX "documents_notice_id_idx" ON "documents"("notice_id");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_created_at_idx" ON "activity_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_actor_id_created_at_idx" ON "activity_logs"("actor_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "legal_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_notices" ADD CONSTRAINT "legal_notices_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_notices" ADD CONSTRAINT "legal_notices_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "legal_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_notices" ADD CONSTRAINT "legal_notices_related_contract_id_fkey" FOREIGN KEY ("related_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "legal_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "legal_notices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "legal_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "legal_notices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "legal_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "legal_notices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraints (exactly one parent matter per child row)
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_single_parent_chk" CHECK (
    (CASE WHEN "case_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "contract_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "notice_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_single_parent_chk" CHECK (
    (CASE WHEN "case_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "contract_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "notice_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_single_parent_chk" CHECK (
    (CASE WHEN "case_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "contract_id" IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN "notice_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);
