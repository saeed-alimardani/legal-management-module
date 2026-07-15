'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '@/lib/enums';
import { buildUserNameMap, loadUserDirectory, userName } from '@/lib/lookups';
import { canManageCoreEntities } from '@/lib/rbac';
import { contractsApi } from '@/lib/services';
import type { Contract } from '@/lib/types';

export default function ContractsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
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
      contractsApi.list({ page, limit: 20, status: status || undefined, type: type || undefined }),
      loadUserDirectory(),
    ])
      .then(([contractsRes, usersRes]) => {
        setItems(contractsRes.data);
        setMeta(contractsRes.meta);
        setUserNames(buildUserNameMap(usersRes));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status, type]);

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Manage agreements, NDAs, and vendor contracts"
        action={
          user && canManageCoreEntities(user.role) ? (
            <Link href="/contracts/new" className="btn-primary">
              New Contract
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No contracts found." />
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
                <th>Counterparty</th>
                <th>Effective</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/contracts/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {item.referenceCode}
                    </Link>
                  </td>
                  <td>{item.title}</td>
                  <td><span className="badge-gray">{item.type}</span></td>
                  <td><span className="badge-blue">{item.status}</span></td>
                  <td>{item.counterpartyName}</td>
                  <td>{formatPersianDate(item.effectiveDate, item.effectiveDatePersian)}</td>
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
