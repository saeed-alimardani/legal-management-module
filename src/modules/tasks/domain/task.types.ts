import { TaskStatus } from '@prisma/client';

export interface TaskEntity {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string;
  dueDate: Date | null;
  caseId: string | null;
  contractId: string | null;
  noticeId: string | null;
  createdById: string;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskWithParent extends TaskEntity {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}

export type TaskResponse = Omit<TaskEntity, 'deletedAt'> & {
  createdAtPersian: string;
  updatedAtPersian: string;
  completedAtPersian: string | null;
  dueDatePersian: string | null;
};

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status: TaskStatus;
  assigneeId: string;
  dueDate?: Date | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
  createdById: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string;
  dueDate?: Date | null;
  completedAt?: Date | null;
}

export interface ListTasksFilters {
  assigneeId?: string;
  status?: TaskStatus;
  caseId?: string;
  contractId?: string;
  noticeId?: string;
  page: number;
  limit: number;
}

export interface TaskListScope {
  counselUserId?: string;
}

export interface ParentRef {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}
