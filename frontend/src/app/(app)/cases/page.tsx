'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { CASE_STATUSES, CASE_TYPES } from '@/lib/enums';
import { buildUserNameMap, loadUserDirectory, userName } from '@/lib/lookups';
import { canManageCoreEntities } from '@/lib/rbac';
import { casesApi } from '@/lib/services';
import type { LegalCase } from '@/lib/types';

export default function CasesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LegalCase[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      casesApi.list({ page, limit: 20, status: status || undefined, type: type || undefined }),
      loadUserDirectory(),
    ])
      .then(([casesRes, usersRes]) => {
        setItems(casesRes.data);
        setMeta(casesRes.meta);
        setUserNames(buildUserNameMap(usersRes));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status, type]);

  return (
    <div>
      <PageHeader
        title="Cases"
        description="Manage litigation and internal legal cases"
        action={
          user && canManageCoreEntities(user.role) ? (
            <Link href="/cases/new" className="btn-primary">
              New Case
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No cases found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Opened</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/cases/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {item.referenceCode}
                    </Link>
                  </td>
                  <td>{item.title}</td>
                  <td><span className="badge-gray">{item.type}</span></td>
                  <td><span className="badge-blue">{item.status}</span></td>
                  <td><span className="badge-yellow">{item.priority}</span></td>
                  <td>{formatPersianDate(item.openedDate, item.openedDatePersian)}</td>
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
