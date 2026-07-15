import DateObject from 'react-date-object';
import gregorian from 'react-date-object/calendars/gregorian';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import type { DateObject as PickerDateObject } from 'react-multi-date-picker';
import { APP_TIMEZONE, localDateTimeToUtcIso } from '@/lib/date';

export { persian, persian_fa };

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Convert a picker DateObject to UTC YYYY-MM-DD without parsing localized digits. */
export function dateObjectToUtcDateString(date: PickerDateObject): string {
  const g = new DateObject(date).convert(gregorian);

  return `${g.year}-${pad2(g.month.number)}-${pad2(g.day)}`;
}

/** Convert a picker DateObject to UTC ISO using the app timezone for wall-clock time. */
export function dateObjectToUtcIso(
  date: PickerDateObject,
  timeZone = APP_TIMEZONE,
): string {
  const g = new DateObject(date).convert(gregorian);

  return localDateTimeToUtcIso(
    g.year,
    g.month.number,
    g.day,
    date.hour ?? 0,
    date.minute ?? 0,
    date.second ?? 0,
    timeZone,
  );
}

export function toPersianDateObject(
  persianDate: string,
): DateObject | undefined {
  if (!persianDate.trim()) return undefined;

  return new DateObject({
    date: persianDate,
    format: 'YYYY/MM/DD',
    calendar: persian,
    locale: persian_fa,
  });
}

export function toPersianDateTimeObject(
  persianDate: string,
  time: string,
): DateObject | undefined {
  if (!persianDate.trim()) return undefined;

  return new DateObject({
    date: `${persianDate} ${time || '00:00'}`,
    format: 'YYYY/MM/DD HH:mm',
    calendar: persian,
    locale: persian_fa,
  });
}
