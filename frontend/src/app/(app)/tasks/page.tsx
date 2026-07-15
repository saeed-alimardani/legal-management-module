'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { TASK_STATUSES } from '@/lib/enums';
import { loadUserDirectory } from '@/lib/lookups';
import { canMutate } from '@/lib/rbac';
import { tasksApi } from '@/lib/services';
import type { Task, UserDirectoryEntry } from '@/lib/types';

export default function TasksPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
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
    tasksApi
      .list({ page, limit: 20, status: status || undefined })
      .then((res) => {
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Manage work items linked to legal matters"
        action={
          user && canMutate(user.role) ? (
            <Link href="/tasks/new" className="btn-primary">
              New Task
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No tasks found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/tasks/${item.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td><span className="badge-blue">{item.status}</span></td>
                  <td>
                    {item.assignee?.fullName
                      ?? assigneeNames.get(item.assigneeId)
                      ?? '—'}
                  </td>
                  <td>{formatPersianDate(item.dueDate, item.dueDatePersian)}</td>
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
