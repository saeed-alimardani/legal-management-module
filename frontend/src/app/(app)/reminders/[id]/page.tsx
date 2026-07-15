'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate, formatPersianDateTime } from '@/lib/date';
import { canEditCreatedResource } from '@/lib/rbac';
import { deadlinesApi, remindersApi } from '@/lib/services';
import type { Deadline, Reminder } from '@/lib/types';

type ReminderDetail = Reminder & { message?: string | null };

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function reminderTitle(item: ReminderDetail): string {
  return item.message ?? item.title ?? 'Reminder';
}

export default function ReminderDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [item, setItem] = useState<ReminderDetail | null>(null);
  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await remindersApi.get(params.id);
      setItem(res.data as ReminderDetail);
      try {
        const deadlineRes = await deadlinesApi.get(res.data.deadlineId);
        setDeadline(deadlineRes.data);
      } catch {
        setDeadline(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminder');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const form = new FormData(event.currentTarget);
    const remindAtLocal = form.get('remindAt') as string;
    try {
      await remindersApi.update(item.id, {
        message: form.get('title') || null,
        remindAt: new Date(remindAtLocal).toISOString(),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDismiss() {
    if (!item || !confirm('Dismiss this reminder?')) return;
    setActionLoading(true);
    try {
      await remindersApi.update(item.id, { status: 'DISMISSED' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss reminder');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !item) return <ErrorState message={error} />;
  if (!item) return null;

  const isPending = item.status === 'PENDING';

  return (
    <div className="space-y-8">
      <PageHeader
        title={reminderTitle(item)}
        description={`Remind at ${formatPersianDateTime(item.remindAt, item.remindAtPersian)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {user && canEditCreatedResource(user, item.createdById) && isPending && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'Cancel Edit' : 'Edit'}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={actionLoading}
                  onClick={handleDismiss}
                >
                  Dismiss
                </button>
              </>
            )}
            <Link href="/reminders" className="btn-secondary">Back</Link>
          </div>
        }
      />

      {error && <ErrorState message={error} />}

      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="text-sm text-slate-500">Status</span>
          <p className="font-medium">{item.status}</p>
        </div>
        <div>
          <span className="text-sm text-slate-500">Remind At</span>
          <p className="font-medium">{formatPersianDateTime(item.remindAt, item.remindAtPersian)}</p>
        </div>
        <div>
          <span className="text-sm text-slate-500">Deadline</span>
          <p className="font-medium">
            <Link href={`/deadlines/${item.deadlineId}`} className="text-brand-600 hover:underline">
              {deadline?.title ?? 'View deadline'}
            </Link>
            {deadline?.dueDate && (
              <span className="ml-1 text-sm text-slate-500">
                (due {formatPersianDate(deadline.dueDate, deadline.dueDatePersian)})
              </span>
            )}
          </p>
        </div>
      </div>

      {editing && (
        <form className="card space-y-4" onSubmit={handleUpdate}>
          <h3 className="font-semibold">Update Reminder</h3>
          <div>
            <label className="label" htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              name="title"
              defaultValue={item.message ?? item.title ?? ''}
              className="w-full"
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-remindAt">Remind At</label>
            <input
              id="edit-remindAt"
              name="remindAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(item.remindAt)}
              required
              className="w-full"
            />
          </div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      )}
    </div>
  );
}
