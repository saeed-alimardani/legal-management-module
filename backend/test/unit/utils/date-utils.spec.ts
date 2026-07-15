import {
  formatDateInTimezone,
  startOfDayInTimezone,
  todayInTimezone,
  toUtcDateOnly,
} from '../../../src/shared/utils/date-boundary.util';
import {
  gregorianToJalali,
  toPersianDateString,
  toPersianDateTimeString,
} from '../../../src/shared/utils/persian-date.util';

describe('date-boundary.util', () => {
  it('formats a known instant in Asia/Tehran', () => {
    const date = new Date('2026-07-14T00:30:00.000Z');
    expect(formatDateInTimezone(date, 'Asia/Tehran')).toBe('2026-07-14');
  });

  it('returns UTC midnight for start of day in timezone', () => {
    const date = new Date('2026-07-14T21:00:00.000Z');
    const start = startOfDayInTimezone(date, 'Asia/Tehran');
    expect(start.toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('todayInTimezone matches startOfDayInTimezone(now)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-14T10:00:00.000Z'));

    expect(todayInTimezone('UTC').toISOString()).toBe(
      '2026-07-14T00:00:00.000Z',
    );

    jest.useRealTimers();
  });

  it('toUtcDateOnly strips time from Date and string inputs', () => {
    expect(
      toUtcDateOnly(new Date('2026-07-20T18:45:00.000Z')).toISOString(),
    ).toBe('2026-07-20T00:00:00.000Z');
    expect(toUtcDateOnly('2026-07-20').toISOString()).toBe(
      '2026-07-20T00:00:00.000Z',
    );
  });
});

describe('persian-date.util', () => {
  it('converts a known Gregorian date to Jalali', () => {
    expect(gregorianToJalali(2026, 7, 14)).toEqual([1405, 4, 23]);
  });

  it('formats Prisma date-only values as Jalali strings', () => {
    const date = new Date('2026-07-14T00:00:00.000Z');
    expect(toPersianDateString(date)).toBe('1405/04/23');
  });

  it('formats UTC timestamps as Jalali datetime in Asia/Tehran', () => {
    const date = new Date('2026-07-14T10:00:00.000Z');
    expect(toPersianDateTimeString(date, 'Asia/Tehran')).toBe(
      '1405/04/23 13:30:00',
    );
  });
});
