'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorModal } from '@/components/ErrorModal';
import { MatterDiscussionsSection } from '@/components/MatterDiscussionsSection';
import { MatterDocumentsSection } from '@/components/MatterDocumentsSection';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { NOTICE_STATUSES } from '@/lib/enums';
import { buildUserNameMap, loadUserDirectory, userName } from '@/lib/lookups';
import { canCreateMatterContent, canDeleteOrReassign, canManageCoreEntities } from '@/lib/rbac';
import {
  casesApi,
  contractsApi,
  noticesApi,
} from '@/lib/services';
import type { Contract, LegalCase, LegalNotice, UserDirectoryEntry } from '@/lib/types';

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<LegalNotice | null>(null);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState('');
  const [modalError, setModalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [reassignOwnerId, setReassignOwnerId] = useState('');

  const showActionError = useCallback((message: string) => {
    setModalError(message);
  }, []);

  function showActionErrorFromUnknown(err: unknown, fallback: string) {
    showActionError(err instanceof Error ? err.message : fallback);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const noticeRes = await noticesApi.get(params.id);
      setItem(noticeRes.data);

      await Promise.all([
        casesApi.list({ limit: 100 }).then((res) => setCases(res.data)),
        contractsApi.list({ limit: 100 }).then((res) => setContracts(res.data)),
        loadUserDirectory().then((directory) => {
          setUsers(directory);
          setUserNames(buildUserNameMap(directory));
        }),
      ]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load notice');
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const form = new FormData(event.currentTarget);
    const relatedCaseId = form.get('relatedCaseId') as string;
    const relatedContractId = form.get('relatedContractId') as string;
    try {
      await noticesApi.update(item.id, {
        title: form.get('title'),
        sender: form.get('sender'),
        receivedDate: form.get('receivedDate'),
        responseDeadline: form.get('responseDeadline'),
        status: form.get('status'),
        description: form.get('description') || null,
        relatedCaseId: relatedCaseId || null,
        relatedContractId: relatedContractId || null,
      });
      setEditing(false);
      await load();
    } catch (err) {
      showActionErrorFromUnknown(err, 'Update failed');
    }
  }

  async function handleDelete() {
    if (!item || !confirm('Delete this notice?')) return;
    try {
      await noticesApi.delete(item.id);
      router.push('/notices');
    } catch (err) {
      showActionErrorFromUnknown(err, 'Delete failed');
    }
  }

  async function handleReassign() {
    if (!item || !reassignOwnerId) return;
    try {
      await noticesApi.reassign(item.id, reassignOwnerId);
      setReassignOwnerId('');
      await load();
    } catch (err) {
      showActionErrorFromUnknown(err, 'Reassign failed');
    }
  }

  if (loading) return <LoadingState />;
  if (loadError && !item) return <ErrorState message={loadError} />;
  if (!item) return null;

  const relatedCase = cases.find((c) => c.id === item.relatedCaseId);
  const relatedContract = contracts.find((c) => c.id === item.relatedContractId);

  return (
    <>
      {modalError && (
        <ErrorModal message={modalError} onClose={() => setModalError('')} />
      )}
    <div className="space-y-8">
      <PageHeader
        title={item.title}
        description={item.referenceCode}
        action={
          <div className="flex flex-wrap gap-2">
            {user && canManageCoreEntities(user.role) && (
              <button type="button" className="btn-secondary" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel Edit' : 'Edit'}
              </button>
            )}
            {user && canDeleteOrReassign(user.role) && (
              <button type="button" className="btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <Link href="/notices" className="btn-secondary">Back</Link>
          </div>
        }
      />

      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="text-sm text-slate-500">Status</span><p className="font-medium">{item.status}</p></div>
        <div><span className="text-sm text-slate-500">Sender</span><p className="font-medium">{item.sender}</p></div>
        <div><span className="text-sm text-slate-500">Owner</span><p className="font-medium">{userName(userNames, item.ownerId)}</p></div>
        <div><span className="text-sm text-slate-500">Received</span><p className="font-medium">{formatPersianDate(item.receivedDate, item.receivedDatePersian)}</p></div>
        <div><span className="text-sm text-slate-500">Response Deadline</span><p className="font-medium">{formatPersianDate(item.responseDeadline, item.responseDeadlinePersian)}</p></div>
        <div>
          <span className="text-sm text-slate-500">Related Case</span>
          <p className="font-medium">
            {item.relatedCaseId ? (
              <Link href={`/cases/${item.relatedCaseId}`} className="text-brand-600 hover:underline">
                {relatedCase ? `${relatedCase.referenceCode} — ${relatedCase.title}` : 'Related case'}
              </Link>
            ) : '—'}
          </p>
        </div>
        <div>
          <span className="text-sm text-slate-500">Related Contract</span>
          <p className="font-medium">
            {item.relatedContractId ? (
              <Link href={`/contracts/${item.relatedContractId}`} className="text-brand-600 hover:underline">
                {relatedContract ? `${relatedContract.referenceCode} — ${relatedContract.title}` : 'Related contract'}
              </Link>
            ) : '—'}
          </p>
        </div>
        {item.description && (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-sm text-slate-500">Description</span>
            <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}
      </div>

      {editing && (
        <form className="card space-y-4" onSubmit={handleUpdate}>
          <h3 className="font-semibold">Edit Notice</h3>
          <input name="title" defaultValue={item.title} required className="w-full" />
          <input name="sender" defaultValue={item.sender} required className="w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <input name="receivedDate" type="date" defaultValue={item.receivedDate?.slice(0, 10) ?? ''} required className="w-full" />
            <input name="responseDeadline" type="date" defaultValue={item.responseDeadline?.slice(0, 10) ?? ''} required className="w-full" />
          </div>
          <select name="status" defaultValue={item.status} className="w-full">
            {NOTICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea name="description" defaultValue={item.description ?? ''} rows={3} className="w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <select name="relatedCaseId" defaultValue={item.relatedCaseId ?? ''} className="w-full">
              <option value="">None</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode} — {c.title}</option>
              ))}
            </select>
            <select name="relatedContractId" defaultValue={item.relatedContractId ?? ''} className="w-full">
              <option value="">None</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode} — {c.title}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      )}

      {user && canDeleteOrReassign(user.role) && (
        <div className="card flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="label">Reassign Owner</label>
            <select value={reassignOwnerId} onChange={(e) => setReassignOwnerId(e.target.value)} className="w-full">
              <option value="">Select user</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <button type="button" className="btn-primary" disabled={!reassignOwnerId} onClick={handleReassign}>
            Reassign
          </button>
        </div>
      )}

      <MatterDocumentsSection
        parentType="notice"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        onError={showActionError}
      />

      <MatterDiscussionsSection
        parentType="notice"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        userNames={userNames}
        onError={showActionError}
      />
    </div>
    </>
  );
}
