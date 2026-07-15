'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { USER_ROLES } from '@/lib/enums';
import { canManageUsers, roleLabel } from '@/lib/rbac';
import { usersApi } from '@/lib/services';

export default function NewUserPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user || !canManageUsers(user.role)) {
    return <ErrorState message="You do not have permission to manage users." />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const res = await usersApi.create({
        email: form.get('email'),
        password: form.get('password'),
        fullName: form.get('fullName'),
        role: form.get('role'),
      });
      router.push(`/users/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New User" description="Create a legal team account" />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="fullName">Full Name</label>
          <input id="fullName" name="fullName" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" required className="w-full">
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create User'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
