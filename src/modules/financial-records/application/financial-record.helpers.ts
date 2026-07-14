import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import {
  FinancialRecordEntity,
  FinancialRecordResponse,
} from '../domain/financial-record.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toFinancialRecordResponse(
  record: FinancialRecordEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): FinancialRecordResponse {
  const zone = resolveResponseTimeZone(timeZone);
  const recordDateUtc = toUtcDateOnly(record.recordDate);

  return {
    id: record.id,
    title: record.title,
    amount: record.amount.toFixed(2),
    currency: record.currency,
    type: record.type,
    description: record.description,
    recordDate: recordDateUtc,
    caseId: record.caseId,
    contractId: record.contractId,
    createdById: record.createdById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    recordDatePersian: toPersianDateString(recordDateUtc),
    createdAtPersian: toPersianDateTimeString(record.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(record.updatedAt, zone),
  };
}

export function resolveParentOwnerId(record: {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
}): string | null {
  if (record.legalCase && record.legalCase.deletedAt === null) {
    return record.legalCase.ownerId;
  }

  if (record.contract && record.contract.deletedAt === null) {
    return record.contract.ownerId;
  }

  return null;
}

export function countParentRefs(parent: {
  caseId?: string | null;
  contractId?: string | null;
}): number {
  return [parent.caseId, parent.contractId].filter(
    (id) => id != null && id !== '',
  ).length;
}
