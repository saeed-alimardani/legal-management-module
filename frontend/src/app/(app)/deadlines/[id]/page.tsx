'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { PersianDateInput } from '@/components/PersianDateInput';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { DEADLINE_STATUSES } from '@/lib/enums';
import { loadUserDirectory } from '@/lib/lookups';
import { canEditCreatedResource } from '@/lib/rbac';
import { deadlinesApi } from '@/lib/services';
import type { Deadline, UserDirectoryEntry } from '@/lib/types';

export default function DeadlineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<Deadline | null>(null);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [deadlineRes, usersDirectory] = await Promise.all([
        deadlinesApi.get(params.id),
        loadUserDirectory(),
      ]);
      setItem(deadlineRes.data);
      setUsers(usersDirectory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deadline');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const form = new FormData(event.currentTarget);
    const assigneeValue = form.get('assigneeId') as string;
    try {
      await deadlinesApi.update(item.id, {
        title: form.get('title'),
        dueDate: form.get('dueDate'),
        status: form.get('status'),
        assigneeId: assigneeValue || null,
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleComplete() {
    if (!item || !confirm('Mark this deadline as completed?')) return;
    setActionLoading(true);
    try {
      await deadlinesApi.update(item.id, { status: 'COMPLETED' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete deadline');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!item || !confirm('Cancel this deadline?')) return;
    setActionLoading(true);
    try {
      await deadlinesApi.delete(item.id);
      router.push('/deadlines');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel deadline');
      setActionLoading(false);
    }
  }

  const assigneeName = item?.assignee?.fullName
    ?? users.find((u) => u.id === item?.assigneeId)?.fullName;

  if (loading) return <LoadingState />;
  if (error && !item) return <ErrorState message={error} />;
  if (!item) return null;

  const isPending = item.status === 'PENDING';

  return (
    <div className="space-y-8">
      <PageHeader
        title={item.title}
        description={`Due ${formatPersianDate(item.dueDate, item.dueDatePersian)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {user && canEditCreatedResource(user, item.createdById) && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'Cancel Edit' : 'Edit'}
                </button>
                {isPending && (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={actionLoading}
                      onClick={handleComplete}
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={actionLoading}
                      onClick={handleCancel}
                    >
                      Cancel Deadline
                    </button>
                  </>
                )}
              </>
            )}
            <Link href="/deadlines" className="btn-secondary">Back</Link>
          </div>
        }
      />

      {error && <ErrorState message={error} />}

      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="text-sm text-slate-500">Status</span>
          <p className="font-medium">{item.status}</p>
        </div>
        <div>
          <span className="text-sm text-slate-500">Due Date</span>
          <p className="font-medium">{formatPersianDate(item.dueDate, item.dueDatePersian)}</p>
        </div>
        <div>
          <span className="text-sm text-slate-500">Assignee</span>
          <p className="font-medium">{assigneeName ?? '—'}</p>
        </div>
        {item.caseId && (
          <div>
            <span className="text-sm text-slate-500">Case</span>
            <p className="font-medium">
              <Link href={`/cases/${item.caseId}`} className="text-brand-600 hover:underline">
                View case
              </Link>
            </p>
          </div>
        )}
        {item.contractId && (
          <div>
            <span className="text-sm text-slate-500">Contract</span>
            <p className="font-medium">
              <Link href={`/contracts/${item.contractId}`} className="text-brand-600 hover:underline">
                View contract
              </Link>
            </p>
          </div>
        )}
        {item.noticeId && (
          <div>
            <span className="text-sm text-slate-500">Notice</span>
            <p className="font-medium">
              <Link href={`/notices/${item.noticeId}`} className="text-brand-600 hover:underline">
                View notice
              </Link>
            </p>
          </div>
        )}
      </div>

      {editing && (
        <form className="card space-y-4" onSubmit={handleUpdate}>
          <h3 className="font-semibold">Edit Deadline</h3>
          <div>
            <label className="label" htmlFor="edit-title">Title</label>
            <input id="edit-title" name="title" defaultValue={item.title} required className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="edit-dueDate">Due Date</label>
              <PersianDateInput
                id="edit-dueDate"
                name="dueDate"
                defaultValue={item.dueDate}
                persianDefault={item.dueDatePersian}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-status">Status</label>
              <select id="edit-status" name="status" defaultValue={item.status} className="w-full">
                {DEADLINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-assigneeId">Assignee</label>
              <select
                id="edit-assigneeId"
                name="assigneeId"
                defaultValue={item.assigneeId ?? ''}
                className="w-full"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      )}
    </div>
  );
}
