'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { canOffboard } from '@/lib/rbac';
import { offboardingApi, usersApi } from '@/lib/services';
import type { User } from '@/lib/types';

export default function OffboardingPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !canOffboard(user.role)) return;

    usersApi
      .list({ limit: 100, isActive: 'true' })
      .then((res) => setUsers(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingUsers(false));
  }, [user]);

  if (!user || !canOffboard(user.role)) {
    return <ErrorState message="You do not have permission to perform offboarding transfers." />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (fromUserId === toUserId) {
      setError('From and to users must be different.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await offboardingApi.transfer({ fromUserId, toUserId });
      const counts = res.data;
      setSuccess(
        `Transfer complete: ${counts.cases} cases, ${counts.contracts} contracts, ` +
        `${counts.notices} notices, ${counts.tasks} tasks, ${counts.deadlines} deadlines.`,
      );
      setFromUserId('');
      setToUserId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Offboarding"
        description="Bulk transfer ownership and assignments between users"
      />

      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      {success && (
        <div className="alert-success mb-4">{success}</div>
      )}

      <form className="card max-w-xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="fromUserId">From User</label>
          <select
            id="fromUserId"
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
            required
            disabled={loadingUsers}
            className="w-full"
          >
            <option value="">Select departing user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="toUserId">To User</label>
          <select
            id="toUserId"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            required
            disabled={loadingUsers}
            className="w-full"
          >
            <option value="">Select receiving user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-500">
          Transfers all cases, contracts, notices, tasks, and deadline assignments
          from the departing user to the receiving user.
        </p>
        <button type="submit" className="btn-primary" disabled={submitting || loadingUsers}>
          {submitting ? 'Transferring...' : 'Transfer Ownership'}
        </button>
      </form>
    </div>
  );
}
