'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { NOTICE_STATUSES } from '@/lib/enums';
import { buildUserNameMap, loadUserDirectory, userName } from '@/lib/lookups';
import { canManageCoreEntities } from '@/lib/rbac';
import { noticesApi } from '@/lib/services';
import type { LegalNotice } from '@/lib/types';

export default function NoticesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LegalNotice[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      noticesApi.list({ page, limit: 20, status: status || undefined }),
      loadUserDirectory(),
    ])
      .then(([noticesRes, usersRes]) => {
        setItems(noticesRes.data);
        setMeta(noticesRes.meta);
        setUserNames(buildUserNameMap(usersRes));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  return (
    <div>
      <PageHeader
        title="Notices"
        description="Track incoming legal notices and response deadlines"
        action={
          user && canManageCoreEntities(user.role) ? (
            <Link href="/notices/new" className="btn-primary">
              New Notice
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {NOTICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No notices found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Sender</th>
                <th>Status</th>
                <th>Received</th>
                <th>Response Deadline</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/notices/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {item.referenceCode}
                    </Link>
                  </td>
                  <td>{item.title}</td>
                  <td>{item.sender}</td>
                  <td><span className="badge-blue">{item.status}</span></td>
                  <td>{formatPersianDate(item.receivedDate, item.receivedDatePersian)}</td>
                  <td>{formatPersianDate(item.responseDeadline, item.responseDeadlinePersian)}</td>
                  <td>{userName(userNames, item.ownerId)}</td>
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
