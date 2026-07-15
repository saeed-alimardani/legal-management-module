'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { DEADLINE_VIEWS } from '@/lib/enums';
import { loadUserDirectory } from '@/lib/lookups';
import { canCreateMatterContent } from '@/lib/rbac';
import { deadlinesApi } from '@/lib/services';
import type { Deadline, UserDirectoryEntry } from '@/lib/types';

const VIEW_LABELS: Record<(typeof DEADLINE_VIEWS)[number], string> = {
  upcoming: 'Upcoming',
  overdue: 'Overdue',
  today: 'Today',
  'assigned-to-me': 'Assigned to Me',
};

export default function DeadlinesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Deadline[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<(typeof DEADLINE_VIEWS)[number]>('upcoming');
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const assigneeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.fullName);
    return map;
  }, [users]);

  useEffect(() => {
    loadUserDirectory().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    deadlinesApi
      .list({ page, limit: 20, view })
      .then((res) => {
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, view]);

  return (
    <div>
      <PageHeader
        title="Deadlines"
        description="Track due dates across cases, contracts, and notices"
        action={
          user && canCreateMatterContent(user.role) ? (
            <Link href="/deadlines/new" className="btn-primary">
              New Deadline
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {DEADLINE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              setView(v);
              setPage(1);
            }}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No deadlines found for this view." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/deadlines/${item.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td>{formatPersianDate(item.dueDate, item.dueDatePersian)}</td>
                  <td><span className="badge-blue">{item.status}</span></td>
                  <td>
                    {item.assignee?.fullName
                      ?? (item.assigneeId ? assigneeNames.get(item.assigneeId) : undefined)
                      ?? '—'}
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
