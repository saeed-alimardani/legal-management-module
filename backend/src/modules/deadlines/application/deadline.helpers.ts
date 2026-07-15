import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import { DeadlineEntity, DeadlineResponse } from '../domain/deadline.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toDeadlineResponse(
  deadline: DeadlineEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): DeadlineResponse {
  const zone = resolveResponseTimeZone(timeZone);

  return {
    id: deadline.id,
    title: deadline.title,
    dueDate: toUtcDateOnly(deadline.dueDate),
    status: deadline.status,
    assigneeId: deadline.assigneeId,
    caseId: deadline.caseId,
    contractId: deadline.contractId,
    noticeId: deadline.noticeId,
    completedAt: deadline.completedAt,
    createdById: deadline.createdById,
    createdAt: deadline.createdAt,
    updatedAt: deadline.updatedAt,
    dueDatePersian: toPersianDateString(toUtcDateOnly(deadline.dueDate)),
    createdAtPersian: toPersianDateTimeString(deadline.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(deadline.updatedAt, zone),
    completedAtPersian: deadline.completedAt
      ? toPersianDateTimeString(deadline.completedAt, zone)
      : null,
  };
}

export function resolveParentOwnerId(deadline: {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}): string | null {
  if (deadline.legalCase && deadline.legalCase.deletedAt === null) {
    return deadline.legalCase.ownerId;
  }

  if (deadline.contract && deadline.contract.deletedAt === null) {
    return deadline.contract.ownerId;
  }

  if (deadline.notice && deadline.notice.deletedAt === null) {
    return deadline.notice.ownerId;
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
