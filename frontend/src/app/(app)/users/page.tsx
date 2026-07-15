'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/date';
import { USER_ROLES } from '@/lib/enums';
import { canManageUsers, roleLabel } from '@/lib/rbac';
import { usersApi } from '@/lib/services';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !canManageUsers(user.role)) return;

    setLoading(true);
    usersApi
      .list({
        page,
        limit: 20,
        role: role || undefined,
        isActive: isActive || undefined,
      })
      .then((res) => {
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, page, role, isActive]);

  if (!user || !canManageUsers(user.role)) {
    return <ErrorState message="You do not have permission to manage users." />;
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage legal team accounts"
        action={
          <Link href="/users/new" className="btn-primary">
            New User
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {USER_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No users found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/users/${item.id}`} className="font-medium text-brand-600 hover:underline">
                      {item.fullName}
                    </Link>
                  </td>
                  <td>{item.email}</td>
                  <td><span className="badge-blue">{roleLabel(item.role)}</span></td>
                  <td>
                    <span className={item.isActive ? 'badge-green' : 'badge-gray'}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
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
