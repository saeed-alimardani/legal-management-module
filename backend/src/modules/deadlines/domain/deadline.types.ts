import { DeadlineStatus } from '@prisma/client';
import { DeadlineView } from './deadline-view.enum';

export interface DeadlineEntity {
  id: string;
  title: string;
  dueDate: Date;
  status: DeadlineStatus;
  assigneeId: string | null;
  caseId: string | null;
  contractId: string | null;
  noticeId: string | null;
  completedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeadlineWithParent extends DeadlineEntity {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}

export interface DeadlineResponse extends DeadlineEntity {
  /** Jalali calendar date for dueDate (DB stores UTC date-only). */
  dueDatePersian: string;
  createdAtPersian: string;
  updatedAtPersian: string;
  completedAtPersian: string | null;
}

export interface CreateDeadlineInput {
  title: string;
  dueDate: Date;
  status: DeadlineStatus;
  assigneeId?: string | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
  createdById: string;
}

export interface UpdateDeadlineInput {
  title?: string;
  dueDate?: Date;
  status?: DeadlineStatus;
  assigneeId?: string | null;
  completedAt?: Date | null;
}

export interface ListDeadlinesFilters {
  view?: DeadlineView;
  today: Date;
  currentUserId: string;
  page: number;
  limit: number;
}

export interface DeadlineListScope {
  counselUserId?: string;
}

export interface ParentRef {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}
