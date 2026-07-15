'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { PersianDateInput } from '@/components/PersianDateInput';
import { ErrorState } from '@/components/States';
import { CASE_STATUSES, CASE_TYPES, PRIORITIES } from '@/lib/enums';
import { casesApi } from '@/lib/services';

export default function NewCasePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const res = await casesApi.create({
        title: form.get('title'),
        type: form.get('type'),
        status: form.get('status') || undefined,
        priority: form.get('priority'),
        description: form.get('description') || undefined,
        openedDate: form.get('openedDate') || undefined,
        closedDate: form.get('closedDate') || undefined,
      });
      router.push(`/cases/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Case" description="Create a legal case" />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="type">Type</label>
            <select id="type" name="type" required className="w-full">
              {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" className="w-full">
              {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" required className="w-full">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={4} className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="openedDate">Opened Date</label>
            <PersianDateInput id="openedDate" name="openedDate" />
          </div>
          <div>
            <label className="label" htmlFor="closedDate">Closed Date</label>
            <PersianDateInput id="closedDate" name="closedDate" />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Case'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
