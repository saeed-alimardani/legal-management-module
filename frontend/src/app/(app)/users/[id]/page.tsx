'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { USER_ROLES } from '@/lib/enums';
import { canManageUsers, roleLabel } from '@/lib/rbac';
import { usersApi } from '@/lib/services';
import type { User } from '@/lib/types';

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [item, setItem] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser || !canManageUsers(currentUser.role)) return;

    usersApi
      .get(params.id)
      .then((res) => setItem(res.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentUser, params.id]);

  if (!currentUser || !canManageUsers(currentUser.role)) {
    return <ErrorState message="You do not have permission to manage users." />;
  }

  if (loading) return <LoadingState />;
  if (error && !item) return <ErrorState message={error} />;
  if (!item) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '').trim();

    const body: Record<string, unknown> = {
      fullName: form.get('fullName'),
      role: form.get('role'),
      isActive: form.get('isActive') === 'true',
    };

    if (password) {
      body.password = password;
    }

    try {
      await usersApi.update(params.id, body);
      router.push('/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={item.fullName}
        description={item.email}
        action={
          <button type="button" className="btn-secondary" onClick={() => router.push('/users')}>
            Back
          </button>
        }
      />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            name="fullName"
            defaultValue={item.fullName}
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue={item.role} className="w-full">
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="isActive">Status</label>
          <select
            id="isActive"
            name="isActive"
            defaultValue={item.isActive ? 'true' : 'false'}
            className="w-full"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="password">New Password</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            placeholder="Leave blank to keep current password"
            className="w-full"
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
