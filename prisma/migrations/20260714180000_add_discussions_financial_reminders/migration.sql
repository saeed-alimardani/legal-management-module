-- CreateEnum
CREATE TYPE "FinancialRecordType" AS ENUM ('EXPENSE', 'INVOICE', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_SENT';

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'DISCUSSION';
ALTER TYPE "EntityType" ADD VALUE 'FINANCIAL_RECORD';
ALTER TYPE "EntityType" ADD VALUE 'REMINDER';

-- CreateTable
CREATE TABLE "discussions" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "case_id" UUID,
    "contract_id" UUID,
    "notice_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_records" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IRR',
    "type" "FinancialRecordType" NOT NULL,
    "description" TEXT,
    "record_date" DATE NOT NULL,
    "case_id" UUID,
    "contract_id" UUID,
    "created_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "financial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "deadline_id" UUID NOT NULL,
    "remind_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "ReminderStatus" NOT NULL,
    "message" VARCHAR(1000),
    "sent_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discussions_case_id_idx" ON "discussions"("case_id");
CREATE INDEX "discussions_contract_id_idx" ON "discussions"("contract_id");
CREATE INDEX "discussions_notice_id_idx" ON "discussions"("notice_id");
CREATE INDEX "discussions_deleted_at_idx" ON "discussions"("deleted_at");

-- CreateIndex
CREATE INDEX "financial_records_case_id_idx" ON "financial_records"("case_id");
CREATE INDEX "financial_records_contract_id_idx" ON "financial_records"("contract_id");
CREATE INDEX "financial_records_record_date_idx" ON "financial_records"("record_date");
CREATE INDEX "financial_records_deleted_at_idx" ON "financial_records"("deleted_at");

-- CreateIndex
CREATE INDEX "reminders_deadline_id_idx" ON "reminders"("deadline_id");
CREATE INDEX "reminders_status_remind_at_idx" ON "reminders"("status", "remind_at");

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "legal_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "legal_notices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "legal_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_deadline_id_fkey" FOREIGN KEY ("deadline_id") REFERENCES "deadlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
