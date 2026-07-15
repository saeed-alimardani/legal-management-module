'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { loadUserDirectory } from '@/lib/lookups';
import {
  casesApi,
  contractsApi,
  deadlinesApi,
  noticesApi,
} from '@/lib/services';
import type { Contract, LegalCase, LegalNotice, UserDirectoryEntry } from '@/lib/types';

type ParentType = 'case' | 'contract' | 'notice';

export default function NewDeadlinePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parentType, setParentType] = useState<ParentType>('case');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notices, setNotices] = useState<LegalNotice[]>([]);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  useEffect(() => {
    Promise.all([
      casesApi.list({ limit: 100 }),
      contractsApi.list({ limit: 100 }),
      noticesApi.list({ limit: 100 }),
      loadUserDirectory(),
    ])
      .then(([casesRes, contractsRes, noticesRes, usersDirectory]) => {
        setCases(casesRes.data);
        setContracts(contractsRes.data);
        setNotices(noticesRes.data);
        setUsers(usersDirectory);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingRefs(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const parentId = form.get('parentId') as string;

    if (!parentId) {
      setError('Please select a parent matter');
      setSubmitting(false);
      return;
    }

    const body: Record<string, unknown> = {
      title: form.get('title'),
      dueDate: form.get('dueDate'),
      assigneeId: form.get('assigneeId') || undefined,
    };

    if (parentType === 'case') body.caseId = parentId;
    else if (parentType === 'contract') body.contractId = parentId;
    else body.noticeId = parentId;

    try {
      const res = await deadlinesApi.create(body);
      router.push(`/deadlines/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deadline');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) return <LoadingState />;

  return (
    <div>
      <PageHeader title="New Deadline" description="Create a deadline on a legal matter" />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="dueDate">Due Date</label>
          <input id="dueDate" name="dueDate" type="date" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="assigneeId">Assignee</label>
          <select id="assigneeId" name="assigneeId" className="w-full">
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="parentType">Parent Type</label>
            <select
              id="parentType"
              value={parentType}
              onChange={(e) => setParentType(e.target.value as ParentType)}
              className="w-full"
            >
              <option value="case">Case</option>
              <option value="contract">Contract</option>
              <option value="notice">Notice</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="parentId">Parent Matter</label>
            <select id="parentId" name="parentId" required className="w-full">
              <option value="">Select…</option>
              {parentType === 'case' && cases.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode} — {c.title}</option>
              ))}
              {parentType === 'contract' && contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode} — {c.title}</option>
              ))}
              {parentType === 'notice' && notices.map((n) => (
                <option key={n.id} value={n.id}>{n.referenceCode} — {n.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Deadline'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
