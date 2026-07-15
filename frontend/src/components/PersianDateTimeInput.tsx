'use client';

import { useMemo, useState } from 'react';
import DatePicker from 'react-multi-date-picker';
import TimePicker from 'react-multi-date-picker/plugins/time_picker';
import type { DateObject } from 'react-multi-date-picker';
import { utcIsoToPersianDateTimeParts } from '@/lib/date';
import {
  dateObjectToUtcIso,
  persian,
  persian_fa,
  toPersianDateTimeObject,
} from '@/lib/persian-calendar';

type PersianDateTimeInputProps = {
  id: string;
  name: string;
  defaultValue?: string | null;
  persianDefault?: string | null;
  required?: boolean;
  className?: string;
};

function resolveInitialParts(
  defaultValue?: string | null,
  persianDefault?: string | null,
): { date: string; time: string } {
  if (persianDefault) {
    const [date = '', time = '00:00'] = persianDefault.split(' ');
    return { date, time: time.slice(0, 5) };
  }

  if (defaultValue) {
    return utcIsoToPersianDateTimeParts(defaultValue);
  }

  return { date: '', time: '' };
}

function resolveInitialUtc(defaultValue?: string | null): string {
  if (defaultValue) return defaultValue;
  return '';
}

export function PersianDateTimeInput({
  id,
  name,
  defaultValue,
  persianDefault,
  required = false,
  className = 'w-full',
}: PersianDateTimeInputProps) {
  const initialParts = useMemo(
    () => resolveInitialParts(defaultValue, persianDefault),
    [defaultValue, persianDefault],
  );
  const [utc, setUtc] = useState(() => resolveInitialUtc(defaultValue));
  const [pickerValue, setPickerValue] = useState<DateObject | undefined>(() =>
    toPersianDateTimeObject(initialParts.date, initialParts.time),
  );

  function handleChange(date: DateObject | DateObject[] | null) {
    if (!date || Array.isArray(date)) {
      setPickerValue(undefined);
      setUtc('');
      return;
    }

    setPickerValue(date);

    try {
      setUtc(dateObjectToUtcIso(date));
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
        format="YYYY/MM/DD HH:mm"
        calendarPosition="bottom-center"
        containerClassName="w-full"
        inputClass="rmdp-input"
        editable={false}
        required={required}
        placeholder="انتخاب تاریخ و ساعت"
        plugins={[<TimePicker key="time" position="bottom" hideSeconds />]}
      />
      <input type="hidden" name={name} value={utc} />
    </div>
  );
}
