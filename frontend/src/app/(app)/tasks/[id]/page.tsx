'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { PersianDateInput } from '@/components/PersianDateInput';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { TASK_STATUSES } from '@/lib/enums';
import { loadUserDirectory } from '@/lib/lookups';
import { canMutate } from '@/lib/rbac';
import { tasksApi } from '@/lib/services';
import type { Task, UserDirectoryEntry } from '@/lib/types';

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<Task | null>(null);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskRes, usersDirectory] = await Promise.all([
        tasksApi.get(params.id),
        loadUserDirectory(),
      ]);
      setItem(taskRes.data);
      setUsers(usersDirectory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
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
    const dueDate = form.get('dueDate') as string;
    try {
      await tasksApi.update(item.id, {
        title: form.get('title'),
        description: form.get('description') || null,
        status: form.get('status'),
        assigneeId: form.get('assigneeId'),
        dueDate: dueDate || null,
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function handleDelete() {
    if (!item || !confirm('Delete this task?')) return;
    try {
      await tasksApi.delete(item.id);
      router.push('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const assigneeName = item?.assignee?.fullName
    ?? users.find((u) => u.id === item?.assigneeId)?.fullName;

  if (loading) return <LoadingState />;
  if (error && !item) return <ErrorState message={error} />;
  if (!item) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={item.title}
        description={item.description ?? 'Task detail'}
        action={
          <div className="flex flex-wrap gap-2">
            {user && canMutate(user.role) && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'Cancel Edit' : 'Edit'}
                </button>
                <button type="button" className="btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              </>
            )}
            <Link href="/tasks" className="btn-secondary">Back</Link>
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
          <span className="text-sm text-slate-500">Assignee</span>
          <p className="font-medium">{assigneeName ?? '—'}</p>
        </div>
        <div>
          <span className="text-sm text-slate-500">Due Date</span>
          <p className="font-medium">{formatPersianDate(item.dueDate, item.dueDatePersian)}</p>
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
        {item.description && (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-sm text-slate-500">Description</span>
            <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}
      </div>

      {editing && (
        <form className="card space-y-4" onSubmit={handleUpdate}>
          <h3 className="font-semibold">Edit Task</h3>
          <div>
            <label className="label" htmlFor="edit-title">Title</label>
            <input id="edit-title" name="title" defaultValue={item.title} required className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              name="description"
              defaultValue={item.description ?? ''}
              rows={3}
              className="w-full"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="edit-status">Status</label>
              <select id="edit-status" name="status" defaultValue={item.status} className="w-full">
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-assigneeId">Assignee</label>
              <select
                id="edit-assigneeId"
                name="assigneeId"
                defaultValue={item.assigneeId}
                required
                className="w-full"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-dueDate">Due Date</label>
              <PersianDateInput
                id="edit-dueDate"
                name="dueDate"
                defaultValue={item.dueDate}
                persianDefault={item.dueDatePersian}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      )}
    </div>
  );
}
