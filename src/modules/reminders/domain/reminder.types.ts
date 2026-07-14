import { ReminderStatus } from '@prisma/client';
import { ReminderView } from './reminder-view.enum';

export interface ReminderEntity {
  id: string;
  deadlineId: string;
  remindAt: Date;
  status: ReminderStatus;
  message: string | null;
  sentAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderWithDeadline extends ReminderEntity {
  deadline: {
    assigneeId: string | null;
    legalCase?: { ownerId: string; deletedAt: Date | null } | null;
    contract?: { ownerId: string; deletedAt: Date | null } | null;
    notice?: { ownerId: string; deletedAt: Date | null } | null;
  };
}

export interface ReminderResponse extends ReminderEntity {
  remindAtPersian: string;
  sentAtPersian: string | null;
  createdAtPersian: string;
  updatedAtPersian: string;
}

export interface CreateReminderInput {
  deadlineId: string;
  remindAt: Date;
  status: ReminderStatus;
  message?: string | null;
  createdById: string;
}

export interface UpdateReminderInput {
  remindAt?: Date;
  message?: string | null;
  status?: ReminderStatus;
  sentAt?: Date | null;
}

export interface ListRemindersFilters {
  view?: ReminderView;
  now: Date;
  currentUserId: string;
  page: number;
  limit: number;
}

export interface ReminderListScope {
  counselUserId?: string;
}
