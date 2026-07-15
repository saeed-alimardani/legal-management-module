export const APP_TIMEZONE = 'Asia/Tehran';

const PERSIAN_DATE_RE = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Classic Gregorian → Jalali conversion (matches backend). */
export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): [number, number, number] {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  let year = gy;

  if (year > 1600) {
    jy = 979;
    year -= 1600;
  } else {
    jy = 0;
    year -= 621;
  }

  const gy2 = gm > 2 ? year + 1 : year;
  let days =
    365 * year +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    gdm[gm - 1];

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm =
    days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return [jy, jm, jd];
}

/** Classic Jalali → Gregorian conversion (inverse of gregorianToJalali). */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): [number, number, number] {
  let gy: number;
  let year = jy;

  if (year > 979) {
    gy = 1600;
    year -= 979;
  } else {
    gy = 621;
  }

  let days =
    365 * year +
    Math.floor(year / 33) * 8 +
    Math.floor(((year % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;

  let leap = true;
  if (days >= 36525) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) {
      days++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days >= 366) {
    leap = false;
    days--;
    gy += Math.floor(days / 365);
    days %= 365;
  }

  const gdm = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= gdm[gm]) {
    days -= gdm[gm];
    gm++;
  }

  return [gy, gm, days + 1];
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parsePersianDateString(value: string): [number, number, number] {
  const match = value.trim().match(PERSIAN_DATE_RE);
  if (!match) {
    throw new Error(`Invalid Persian date: ${value}`);
  }

  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);

  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    throw new Error(`Invalid Persian date: ${value}`);
  }

  return [jy, jm, jd];
}

/** UTC ISO / YYYY-MM-DD → Jalali YYYY/MM/DD (UTC calendar day, matches backend storage). */
export function utcIsoToPersianDateString(iso?: string | null): string {
  if (!iso) return '';
  const ymd = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`Invalid UTC date: ${iso}`);
  }

  const [gy, gm, gd] = ymd.split('-').map(Number);
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

/** Jalali YYYY/MM/DD → UTC date string YYYY-MM-DD for backend date-only fields. */
export function persianDateStringToUtcDateString(value: string): string {
  const [jy, jm, jd] = parsePersianDateString(value);
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

type GregorianDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getGregorianPartsInTimezone(
  date: Date,
  timeZone: string,
): GregorianDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const second = Number(parts.find((part) => part.type === 'second')?.value ?? 0);

  return { year, month, day, hour, minute, second };
}

/** UTC ISO → Persian date and HH:MM in the app timezone. */
export function utcIsoToPersianDateTimeParts(
  iso?: string | null,
  timeZone = APP_TIMEZONE,
): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };

  const observed = getGregorianPartsInTimezone(new Date(iso), timeZone);
  const [jy, jm, jd] = gregorianToJalali(
    observed.year,
    observed.month,
    observed.day,
  );

  return {
    date: `${jy}/${pad2(jm)}/${pad2(jd)}`,
    time: `${pad2(observed.hour)}:${pad2(observed.minute)}`,
  };
}

export function localDateTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): string {
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let attempt = 0; attempt < 24; attempt++) {
    const observed = getGregorianPartsInTimezone(new Date(utcGuess), timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const observedMs = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const diff = observedMs - targetMs;
    if (diff === 0) {
      return new Date(utcGuess).toISOString();
    }
    utcGuess -= diff;
  }

  return new Date(utcGuess).toISOString();
}

/** Persian date + local time (Asia/Tehran) → UTC ISO string for backend timestamps. */
export function persianDateTimeToUtcIso(
  persianDate: string,
  time: string,
  timeZone = APP_TIMEZONE,
): string {
  const trimmedDate = persianDate.trim();
  const trimmedTime = time.trim();
  if (!trimmedDate || !trimmedTime) return '';

  const timeMatch = trimmedTime.match(TIME_RE);
  if (!timeMatch) {
    throw new Error(`Invalid time: ${time}`);
  }

  const utcDate = persianDateStringToUtcDateString(trimmedDate);
  const [year, month, day] = utcDate.split('-').map(Number);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? '0');

  return localDateTimeToUtcIso(
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeZone,
  );
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA');
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function formatPersianDate(iso?: string | null, persian?: string | null): string {
  if (persian) return persian;
  return formatDate(iso);
}

export function formatPersianDateTime(iso?: string | null, persian?: string | null): string {
  if (persian) return persian;
  return formatDateTime(iso);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCurrency(amount: number | string, currency: string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}
