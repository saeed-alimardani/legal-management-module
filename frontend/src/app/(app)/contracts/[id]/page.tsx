'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorModal } from '@/components/ErrorModal';
import { MatterDiscussionsSection } from '@/components/MatterDiscussionsSection';
import { MatterDocumentsSection } from '@/components/MatterDocumentsSection';
import { MatterFinancialRecordsSection } from '@/components/MatterFinancialRecordsSection';
import { PageHeader } from '@/components/PageHeader';
import { PersianDateInput } from '@/components/PersianDateInput';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatPersianDate } from '@/lib/date';
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '@/lib/enums';
import { buildUserNameMap, loadUserDirectory, userName } from '@/lib/lookups';
import { canCreateMatterContent, canDeleteOrReassign, canManageCoreEntities } from '@/lib/rbac';
import { contractsApi } from '@/lib/services';
import type { Contract, UserDirectoryEntry } from '@/lib/types';

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<Contract | null>(null);
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
      const contractRes = await contractsApi.get(params.id);
      setItem(contractRes.data);
      const usersDirectory = await loadUserDirectory();
      setUsers(usersDirectory);
      setUserNames(buildUserNameMap(usersDirectory));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load contract');
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
    try {
      await contractsApi.update(item.id, {
        title: form.get('title'),
        type: form.get('type'),
        status: form.get('status'),
        counterpartyName: form.get('counterpartyName'),
        keyTerms: form.get('keyTerms') || null,
        effectiveDate: form.get('effectiveDate') || null,
        expirationDate: form.get('expirationDate') || null,
        renewalDate: form.get('renewalDate') || null,
      });
      setEditing(false);
      await load();
    } catch (err) {
      showActionErrorFromUnknown(err, 'Update failed');
    }
  }

  async function handleDelete() {
    if (!item || !confirm('Delete this contract?')) return;
    try {
      await contractsApi.delete(item.id);
      router.push('/contracts');
    } catch (err) {
      showActionErrorFromUnknown(err, 'Delete failed');
    }
  }

  async function handleReassign() {
    if (!item || !reassignOwnerId) return;
    try {
      await contractsApi.reassign(item.id, reassignOwnerId);
      setReassignOwnerId('');
      await load();
    } catch (err) {
      showActionErrorFromUnknown(err, 'Reassign failed');
    }
  }

  if (loading) return <LoadingState />;
  if (loadError && !item) return <ErrorState message={loadError} />;
  if (!item) return null;

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
            <Link href="/contracts" className="btn-secondary">Back</Link>
          </div>
        }
      />

      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="text-sm text-slate-500">Status</span><p className="font-medium">{item.status}</p></div>
        <div><span className="text-sm text-slate-500">Type</span><p className="font-medium">{item.type}</p></div>
        <div><span className="text-sm text-slate-500">Counterparty</span><p className="font-medium">{item.counterpartyName}</p></div>
        <div><span className="text-sm text-slate-500">Owner</span><p className="font-medium">{userName(userNames, item.ownerId)}</p></div>
        <div><span className="text-sm text-slate-500">Effective</span><p className="font-medium">{formatPersianDate(item.effectiveDate, item.effectiveDatePersian)}</p></div>
        <div><span className="text-sm text-slate-500">Expiration</span><p className="font-medium">{formatPersianDate(item.expirationDate, item.expirationDatePersian)}</p></div>
        <div><span className="text-sm text-slate-500">Renewal</span><p className="font-medium">{formatPersianDate(item.renewalDate, item.renewalDatePersian)}</p></div>
        {item.keyTerms && (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-sm text-slate-500">Key Terms</span>
            <p className="mt-1 whitespace-pre-wrap">{item.keyTerms}</p>
          </div>
        )}
      </div>

      {editing && (
        <form className="card space-y-4" onSubmit={handleUpdate}>
          <h3 className="font-semibold">Edit Contract</h3>
          <div>
            <label className="label" htmlFor="edit-contract-title">Title</label>
            <input id="edit-contract-title" name="title" defaultValue={item.title} required className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit-contract-type">Type</label>
              <select id="edit-contract-type" name="type" defaultValue={item.type} className="w-full">
                {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-contract-status">Status</label>
              <select id="edit-contract-status" name="status" defaultValue={item.status} className="w-full">
                {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="edit-contract-counterparty">Counterparty</label>
            <input id="edit-contract-counterparty" name="counterpartyName" defaultValue={item.counterpartyName} required className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="edit-contract-keyTerms">Key Terms</label>
            <textarea id="edit-contract-keyTerms" name="keyTerms" defaultValue={item.keyTerms ?? ''} rows={3} className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="edit-contract-effectiveDate">Effective Date</label>
              <PersianDateInput
                id="edit-contract-effectiveDate"
                name="effectiveDate"
                defaultValue={item.effectiveDate}
                persianDefault={item.effectiveDatePersian}
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-contract-expirationDate">Expiration Date</label>
              <PersianDateInput
                id="edit-contract-expirationDate"
                name="expirationDate"
                defaultValue={item.expirationDate}
                persianDefault={item.expirationDatePersian}
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-contract-renewalDate">Renewal Date</label>
              <PersianDateInput
                id="edit-contract-renewalDate"
                name="renewalDate"
                defaultValue={item.renewalDate}
                persianDefault={item.renewalDatePersian}
              />
            </div>
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
        parentType="contract"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        onError={showActionError}
      />

      <MatterDiscussionsSection
        parentType="contract"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        userNames={userNames}
        onError={showActionError}
      />

      <MatterFinancialRecordsSection
        parentType="contract"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        onError={showActionError}
      />
    </div>
    </>
  );
}
