'use client';

import { useMemo, useState } from 'react';
import DatePicker from 'react-multi-date-picker';
import type { DateObject } from 'react-multi-date-picker';
import { utcIsoToPersianDateString } from '@/lib/date';
import {
  dateObjectToUtcDateString,
  persian,
  persian_fa,
  toPersianDateObject,
} from '@/lib/persian-calendar';

type PersianDateInputProps = {
  id: string;
  name: string;
  defaultValue?: string | null;
  persianDefault?: string | null;
  required?: boolean;
  className?: string;
};

function resolveInitialPersian(
  defaultValue?: string | null,
  persianDefault?: string | null,
): string {
  if (persianDefault) return persianDefault;
  if (defaultValue) return utcIsoToPersianDateString(defaultValue);
  return '';
}

function resolveInitialUtc(defaultValue?: string | null): string {
  if (defaultValue) return defaultValue.slice(0, 10);
  return '';
}

export function PersianDateInput({
  id,
  name,
  defaultValue,
  persianDefault,
  required = false,
  className = 'w-full',
}: PersianDateInputProps) {
  const initialPersian = useMemo(
    () => resolveInitialPersian(defaultValue, persianDefault),
    [defaultValue, persianDefault],
  );
  const [utc, setUtc] = useState(() => resolveInitialUtc(defaultValue));
  const [pickerValue, setPickerValue] = useState<DateObject | undefined>(() =>
    toPersianDateObject(initialPersian),
  );

  function handleChange(date: DateObject | DateObject[] | null) {
    if (!date || Array.isArray(date)) {
      setPickerValue(undefined);
      setUtc('');
      return;
    }

    setPickerValue(date);

    try {
      setUtc(dateObjectToUtcDateString(date));
    } catch {
      setUtc('');
    }
  }

  return (
    <div className={className}>
      <DatePicker
        id={id}
        value={pickerValue}
        onChange={handleChange}
        calendar={persian}
        locale={persian_fa}
        format="YYYY/MM/DD"
        calendarPosition="bottom-center"
        containerClassName="w-full"
        inputClass="rmdp-input"
        editable={false}
        required={required}
        placeholder="انتخاب تاریخ"
      />
      <input type="hidden" name={name} value={utc} />
    </div>
  );
}
