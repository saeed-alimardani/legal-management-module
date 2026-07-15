'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDateTime } from '@/lib/date';
import { canCreateMatterContent, canProcessReminders } from '@/lib/rbac';
import { deadlinesApi, remindersApi } from '@/lib/services';
import type { Deadline, Reminder } from '@/lib/types';

type ReminderRow = Reminder & { message?: string | null };
type ReminderStatusFilter = '' | 'PENDING' | 'DISMISSED';

const STATUS_FILTER_OPTIONS: { value: ReminderStatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

function reminderTitle(item: ReminderRow): string {
  return item.message ?? item.title ?? '—';
}

export default function RemindersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReminderRow[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReminderStatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    const listParams: Record<string, string | number> = { page, limit: 20 };
    if (statusFilter) listParams.status = statusFilter;

    Promise.all([
      remindersApi.list(listParams),
      deadlinesApi.list({ limit: 100 }),
    ])
      .then(([remindersRes, deadlinesRes]) => {
        setItems(remindersRes.data as ReminderRow[]);
        setMeta(remindersRes.meta);
        setDeadlines(deadlinesRes.data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  async function handleProcessDue() {
    if (!confirm('Process all due pending reminders?')) return;
    setProcessing(true);
    setProcessMessage('');
    setError('');
    try {
      const res = await remindersApi.processDue();
      setProcessMessage(`Processed ${res.data.processedCount} reminder(s).`);
      setPage(1);
      const listParams: Record<string, string | number> = { page: 1, limit: 20 };
      if (statusFilter) listParams.status = statusFilter;
      const [listRes, deadlinesRes] = await Promise.all([
        remindersApi.list(listParams),
        deadlinesApi.list({ limit: 100 }),
      ]);
      setItems(listRes.data as ReminderRow[]);
      setMeta(listRes.meta);
      setDeadlines(deadlinesRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process reminders');
    } finally {
      setProcessing(false);
    }
  }

  function deadlineTitle(deadlineId: string): string {
    const deadline = deadlines.find((d) => d.id === deadlineId);
    return deadline?.title ?? 'View deadline';
  }

  function handleStatusChange(value: ReminderStatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Reminders"
        description="Schedule and track deadline reminders"
        action={
          <div className="flex flex-wrap gap-2">
            {user && canProcessReminders(user.role) && (
              <button
                type="button"
                className="btn-secondary"
                disabled={processing}
                onClick={handleProcessDue}
              >
                {processing ? 'Processing...' : 'Process Due'}
              </button>
            )}
            {user && canCreateMatterContent(user.role) && (
              <Link href="/reminders/new" className="btn-primary">
                New Reminder
              </Link>
            )}
          </div>
        }
      />

      <div className="card mb-4 max-w-xs">
        <label className="label" htmlFor="reminder-status-filter">Status</label>
        <select
          id="reminder-status-filter"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as ReminderStatusFilter)}
          className="w-full"
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {processMessage && (
        <p className="mb-4 text-sm text-green-700">{processMessage}</p>
      )}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No reminders found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Remind At</th>
                <th>Status</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/reminders/${item.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {reminderTitle(item)}
                    </Link>
                  </td>
                  <td>{formatPersianDateTime(item.remindAt, item.remindAtPersian)}</td>
                  <td><span className="badge-blue">{item.status}</span></td>
                  <td>
                    <Link
                      href={`/deadlines/${item.deadlineId}`}
                      className="text-brand-600 hover:underline"
                    >
                      {deadlineTitle(item.deadlineId)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
