import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { CONFIG_KEYS } from '../../../config/constants';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import { LegalCaseEntity, CaseResponse } from '../domain/case.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveCaseResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function getCaseResponseTimeZone(configService: {
  get: (key: string) => string | undefined;
}): string {
  return resolveCaseResponseTimeZone(
    configService.get(CONFIG_KEYS.APP_TIMEZONE),
  );
}

export function toCaseResponse(
  legalCase: LegalCaseEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): CaseResponse {
  const zone = resolveCaseResponseTimeZone(timeZone);
  const openedDate = legalCase.openedDate
    ? toUtcDateOnly(legalCase.openedDate)
    : null;
  const closedDate = legalCase.closedDate
    ? toUtcDateOnly(legalCase.closedDate)
    : null;

  return {
    id: legalCase.id,
    referenceCode: legalCase.referenceCode,
    title: legalCase.title,
    type: legalCase.type,
    status: legalCase.status,
    priority: legalCase.priority,
    ownerId: legalCase.ownerId,
    description: legalCase.description,
    openedDate,
    closedDate,
    createdAt: legalCase.createdAt,
    updatedAt: legalCase.updatedAt,
    openedDatePersian: openedDate ? toPersianDateString(openedDate) : null,
    closedDatePersian: closedDate ? toPersianDateString(closedDate) : null,
    createdAtPersian: toPersianDateTimeString(legalCase.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(legalCase.updatedAt, zone),
    parties: legalCase.parties,
  };
}
