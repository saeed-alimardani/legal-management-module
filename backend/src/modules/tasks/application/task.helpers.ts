import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import { TaskEntity, TaskResponse } from '../domain/task.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toTaskResponse(
  task: TaskEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): TaskResponse {
  const zone = resolveResponseTimeZone(timeZone);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate ? toUtcDateOnly(task.dueDate) : null,
    caseId: task.caseId,
    contractId: task.contractId,
    noticeId: task.noticeId,
    createdById: task.createdById,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    dueDatePersian: task.dueDate
      ? toPersianDateString(toUtcDateOnly(task.dueDate))
      : null,
    createdAtPersian: toPersianDateTimeString(task.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(task.updatedAt, zone),
    completedAtPersian: task.completedAt
      ? toPersianDateTimeString(task.completedAt, zone)
      : null,
  };
}

export function resolveParentOwnerId(task: {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}): string | null {
  if (task.legalCase && task.legalCase.deletedAt === null) {
    return task.legalCase.ownerId;
  }

  if (task.contract && task.contract.deletedAt === null) {
    return task.contract.ownerId;
  }

  if (task.notice && task.notice.deletedAt === null) {
    return task.notice.ownerId;
  }

  return null;
}

export function countParentRefs(parent: {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}): number {
  return [parent.caseId, parent.contractId, parent.noticeId].filter(
    (id) => id != null && id !== '',
  ).length;
}
