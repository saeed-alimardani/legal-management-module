'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { PersianDateTimeInput } from '@/components/PersianDateTimeInput';
import { ErrorState, LoadingState } from '@/components/States';
import { formatPersianDate } from '@/lib/date';
import { deadlinesApi, remindersApi } from '@/lib/services';
import type { Deadline } from '@/lib/types';

export default function NewReminderPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  useEffect(() => {
    deadlinesApi
      .list({ limit: 100, view: 'upcoming' })
      .then((res) => setDeadlines(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingRefs(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const remindAtLocal = form.get('remindAt') as string;

    try {
      const res = await remindersApi.create({
        message: form.get('title') || undefined,
        deadlineId: form.get('deadlineId'),
        remindAt: new Date(remindAtLocal).toISOString(),
      });
      router.push(`/reminders/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) return <LoadingState />;

  return (
    <div>
      <PageHeader title="New Reminder" description="Schedule a reminder for a deadline" />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="remindAt">Remind At</label>
          <PersianDateTimeInput id="remindAt" name="remindAt" required />
        </div>
        <div>
          <label className="label" htmlFor="deadlineId">Deadline</label>
          <select id="deadlineId" name="deadlineId" required className="w-full">
            <option value="">Select deadline…</option>
            {deadlines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} — due {formatPersianDate(d.dueDate, d.dueDatePersian)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Reminder'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
