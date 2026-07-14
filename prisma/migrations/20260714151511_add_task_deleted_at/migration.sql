-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");
