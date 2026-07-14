import { ReminderStatus } from '@prisma/client';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { toPersianDateTimeString } from '../../../shared/utils/persian-date.util';
import {
  CreateReminderInput,
  ReminderEntity,
  ReminderResponse,
  ReminderWithDeadline,
} from '../domain/reminder.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toReminderResponse(
  reminder: ReminderEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): ReminderResponse {
  const zone = resolveResponseTimeZone(timeZone);

  return {
    id: reminder.id,
    deadlineId: reminder.deadlineId,
    remindAt: reminder.remindAt,
    status: reminder.status,
    message: reminder.message,
    sentAt: reminder.sentAt,
    createdById: reminder.createdById,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
    remindAtPersian: toPersianDateTimeString(reminder.remindAt, zone),
    sentAtPersian: reminder.sentAt
      ? toPersianDateTimeString(reminder.sentAt, zone)
      : null,
    createdAtPersian: toPersianDateTimeString(reminder.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(reminder.updatedAt, zone),
  };
}

export function resolveParentOwnerId(
  reminder: ReminderWithDeadline,
): string | null {
  const deadline = reminder.deadline;

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

/**
 * Default reminder: one calendar day before dueDate at 09:00 in APP_TIMEZONE.
 * assigneeId is accepted for API symmetry with deadline creation flows.
 */
export function createDefaultReminder(
  deadlineId: string,
  dueDate: Date,
  _assigneeId: string | null | undefined,
  createdById: string,
  timeZone: string = DEFAULT_TIMEZONE,
): CreateReminderInput {
  return {
    deadlineId,
    remindAt: computeDefaultRemindAt(dueDate, timeZone),
    status: ReminderStatus.PENDING,
    message: null,
    createdById,
  };
}

export function computeDefaultRemindAt(dueDate: Date, timeZone: string): Date {
  const dueUtc = toUtcDateOnly(dueDate);
  const oneDayBefore = new Date(dueUtc.getTime() - 24 * 60 * 60 * 1000);
  const ymd = oneDayBefore.toISOString().slice(0, 10);

  return wallClockToUtc(ymd, 9, 0, timeZone);
}

/** Converts a wall-clock instant in an IANA timezone to a UTC Date. */
export function wallClockToUtc(
  ymd: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(guess).map((part) => [part.type, part.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const target = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess = new Date(guess.getTime() + (target - asUtc));
  }

  return guess;
}
