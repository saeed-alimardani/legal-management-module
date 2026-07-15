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
import { Pagination } from '@/components/Pagination';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, formatPersianDate } from '@/lib/date';
import {
  CASE_STATUSES,
  CASE_TYPES,
  PARTY_TYPES,
  PRIORITIES,
} from '@/lib/enums';
import { buildUserNameMap, loadUserDirectory, userName } from '@/lib/lookups';
import { canCreateMatterContent, canDeleteOrReassign, canManageCoreEntities } from '@/lib/rbac';
import { casesApi } from '@/lib/services';
import type {
  CaseParty,
  LegalCase,
  TimelineEntry,
  UserDirectoryEntry,
} from '@/lib/types';

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<LegalCase | null>(null);
  const [parties, setParties] = useState<CaseParty[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineMeta, setTimelineMeta] = useState({ page: 1, limit: 10, total: 0 });
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
      const [caseRes, partiesRes, timelineRes] = await Promise.all([
        casesApi.get(params.id),
        casesApi.listParties(params.id),
        casesApi.timeline(params.id, 1, 10),
      ]);
      setItem(caseRes.data);
      setParties(
        Array.isArray(partiesRes.data)
          ? partiesRes.data
          : caseRes.data.parties ?? [],
      );
      setTimeline(timelineRes.data);
      setTimelineMeta(timelineRes.meta);
      const usersDirectory = await loadUserDirectory();
      setUsers(usersDirectory);
      setUserNames(buildUserNameMap(usersDirectory));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load case');
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
    try {
      await casesApi.update(item.id, {
        title: form.get('title'),
        type: form.get('type'),
        status: form.get('status'),
        priority: form.get('priority'),
        description: form.get('description') || null,
        openedDate: form.get('openedDate') || null,
        closedDate: form.get('closedDate') || null,
      });
      setEditing(false);
      await load();
    } catch (err) {
      showActionErrorFromUnknown(err, 'Update failed');
    }
  }

  async function handleDelete() {
    if (!item || !confirm('Delete this case?')) return;
    try {
      await casesApi.delete(item.id);
      router.push('/cases');
    } catch (err) {
      showActionErrorFromUnknown(err, 'Delete failed');
    }
  }

  async function handleReassign() {
    if (!item || !reassignOwnerId) return;
    try {
      await casesApi.reassign(item.id, reassignOwnerId);
      setReassignOwnerId('');
      await load();
    } catch (err) {
      showActionErrorFromUnknown(err, 'Reassign failed');
    }
  }

  async function handleAddParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      const res = await casesApi.addParty(params.id, {
        name: form.get('name'),
        partyType: form.get('partyType'),
        contactInfo: form.get('contactInfo') || undefined,
        notes: form.get('notes') || undefined,
      });
      formEl.reset();
      setParties((prev) => [...prev, res.data]);
    } catch (err) {
      showActionErrorFromUnknown(err, 'Failed to add party');
    }
  }

  async function handleDeleteParty(partyId: string) {
    if (!confirm('Remove this party?')) return;
    try {
      await casesApi.deleteParty(params.id, partyId);
      setParties((prev) => prev.filter((party) => party.id !== partyId));
    } catch (err) {
      showActionErrorFromUnknown(err, 'Failed to remove party');
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
              <>
                <button type="button" className="btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              </>
            )}
            <Link href="/cases" className="btn-secondary">Back</Link>
          </div>
        }
      />

      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="text-sm text-slate-500">Status</span><p className="font-medium">{item.status}</p></div>
        <div><span className="text-sm text-slate-500">Type</span><p className="font-medium">{item.type}</p></div>
        <div><span className="text-sm text-slate-500">Priority</span><p className="font-medium">{item.priority}</p></div>
        <div><span className="text-sm text-slate-500">Owner</span><p className="font-medium">{userName(userNames, item.ownerId)}</p></div>
        <div><span className="text-sm text-slate-500">Opened</span><p className="font-medium">{formatPersianDate(item.openedDate, item.openedDatePersian)}</p></div>
        <div><span className="text-sm text-slate-500">Closed</span><p className="font-medium">{formatPersianDate(item.closedDate, item.closedDatePersian)}</p></div>
        {item.description && (
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-sm text-slate-500">Description</span>
            <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}
      </div>

      {editing && (
        <form className="card space-y-4" onSubmit={handleUpdate}>
          <h3 className="font-semibold">Edit Case</h3>
          <div>
            <label className="label" htmlFor="edit-case-title">Title</label>
            <input id="edit-case-title" name="title" defaultValue={item.title} required className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="edit-case-type">Type</label>
              <select id="edit-case-type" name="type" defaultValue={item.type} className="w-full">
                {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-case-status">Status</label>
              <select id="edit-case-status" name="status" defaultValue={item.status} className="w-full">
                {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-case-priority">Priority</label>
              <select id="edit-case-priority" name="priority" defaultValue={item.priority} className="w-full">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="edit-case-description">Description</label>
            <textarea id="edit-case-description" name="description" defaultValue={item.description ?? ''} rows={3} className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edit-case-openedDate">Opened Date</label>
              <PersianDateInput
                id="edit-case-openedDate"
                name="openedDate"
                defaultValue={item.openedDate}
                persianDefault={item.openedDatePersian}
              />
            </div>
            <div>
              <label className="label" htmlFor="edit-case-closedDate">Closed Date</label>
              <PersianDateInput
                id="edit-case-closedDate"
                name="closedDate"
                defaultValue={item.closedDate}
                persianDefault={item.closedDatePersian}
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

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Parties</h3>
        {user && canManageCoreEntities(user.role) && (
          <form className="card grid gap-3 sm:grid-cols-2" onSubmit={handleAddParty}>
            <input name="name" placeholder="Name" required />
            <select name="partyType" required>
              {PARTY_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input name="contactInfo" placeholder="Contact info" />
            <input name="notes" placeholder="Notes" />
            <button type="submit" className="btn-primary sm:col-span-2">Add Party</button>
          </form>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Type</th><th>Contact</th><th>Actions</th></tr></thead>
            <tbody>
              {parties.map((party) => (
                <tr key={party.id}>
                  <td>{party.name}</td>
                  <td>{party.partyType}</td>
                  <td>{party.contactInfo ?? '—'}</td>
                  <td>
                    {user && canManageCoreEntities(user.role) && (
                      <button type="button" className="text-red-600" onClick={() => handleDeleteParty(party.id)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Timeline</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Action</th><th>Actor</th><th>When</th></tr></thead>
            <tbody>
              {timeline.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.action}</td>
                  <td>{entry.actor?.fullName ?? '—'}</td>
                  <td>{formatDateTime(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={timelineMeta} onPageChange={async (p) => {
            const res = await casesApi.timeline(params.id, p, 10);
            setTimeline(res.data);
            setTimelineMeta(res.meta);
          }} />
        </div>
      </section>

      <MatterDocumentsSection
        parentType="case"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        onError={showActionError}
      />

      <MatterDiscussionsSection
        parentType="case"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        userNames={userNames}
        onError={showActionError}
      />

      <MatterFinancialRecordsSection
        parentType="case"
        parentId={params.id}
        canEdit={Boolean(user && canCreateMatterContent(user.role))}
        onError={showActionError}
      />
    </div>
    </>
  );
}
