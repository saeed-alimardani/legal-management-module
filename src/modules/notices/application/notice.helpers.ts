import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import {
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../shared/utils/persian-date.util';
import { LegalNoticeEntity, NoticeResponse } from '../domain/notice.types';

const DEFAULT_TIMEZONE = 'Asia/Tehran';

export function resolveNoticeResponseTimeZone(timeZone?: string): string {
  return timeZone || DEFAULT_TIMEZONE;
}

export function toNoticeResponse(
  notice: LegalNoticeEntity,
  timeZone: string = DEFAULT_TIMEZONE,
): NoticeResponse {
  const zone = resolveNoticeResponseTimeZone(timeZone);
  const receivedDate = toUtcDateOnly(notice.receivedDate);
  const responseDeadline = toUtcDateOnly(notice.responseDeadline);

  return {
    ...notice,
    receivedDate,
    responseDeadline,
    receivedDatePersian: toPersianDateString(receivedDate),
    responseDeadlinePersian: toPersianDateString(responseDeadline),
    createdAtPersian: toPersianDateTimeString(notice.createdAt, zone),
    updatedAtPersian: toPersianDateTimeString(notice.updatedAt, zone),
  };
}
