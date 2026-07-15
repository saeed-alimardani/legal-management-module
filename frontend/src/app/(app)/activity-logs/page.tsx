'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/date';
import { ENTITY_TYPES } from '@/lib/enums';
import { canViewActivityLogs } from '@/lib/rbac';
import { activityLogsApi } from '@/lib/services';
import type { ActivityLog } from '@/lib/types';

export default function ActivityLogsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    if (!canViewActivityLogs(user.role)) {
      router.replace('/dashboard');
      return;
    }

    setLoading(true);
    activityLogsApi
      .list({
        page,
        limit: 20,
        entityType: entityType || undefined,
      })
      .then((res) => {
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, entityType, user, router]);

  if (user && !canViewActivityLogs(user.role)) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Activity Logs"
        description="Read-only audit trail of system actions"
      />

      <div className="mb-4">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No activity logs found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><span className="badge-blue">{item.action}</span></td>
                  <td>
                    <span className="badge-gray">{item.entityType}</span>
                    <span className="ml-2 text-xs text-slate-500">{item.entityId.slice(0, 8)}…</span>
                  </td>
                  <td>{item.actor?.fullName ?? item.actorId.slice(0, 8)}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
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
