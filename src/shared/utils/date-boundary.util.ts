/**
 * Normalize a calendar date to UTC midnight for Prisma `@db.Date` storage.
 * Accepts Date or ISO/date string; always persists as UTC, never local wall-clock.
 */
export function toUtcDateOnly(input: Date | string): Date {
  if (typeof input === 'string') {
    const ymd = input.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      throw new Error(`Invalid date string: ${input}`);
    }
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
}

/** Calendar date (YYYY-MM-DD) for `date` in the given IANA timezone. */
export function formatDateInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date in timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Start of the calendar day in `timeZone`, as a UTC midnight Date
 * suitable for Prisma `@db.Date` comparisons.
 */
export function startOfDayInTimezone(date: Date, timeZone: string): Date {
  const ymd = formatDateInTimezone(date, timeZone);
  return toUtcDateOnly(ymd);
}

export function todayInTimezone(timeZone: string): Date {
  return startOfDayInTimezone(new Date(), timeZone);
}
