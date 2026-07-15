'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { NOTICE_STATUSES } from '@/lib/enums';
import { casesApi, contractsApi, noticesApi } from '@/lib/services';
import type { Contract, LegalCase } from '@/lib/types';

export default function NewNoticePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  useEffect(() => {
    Promise.all([
      casesApi.list({ limit: 100 }),
      contractsApi.list({ limit: 100 }),
    ])
      .then(([casesRes, contractsRes]) => {
        setCases(casesRes.data);
        setContracts(contractsRes.data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingRefs(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const res = await noticesApi.create({
        title: form.get('title'),
        sender: form.get('sender'),
        receivedDate: form.get('receivedDate'),
        responseDeadline: form.get('responseDeadline'),
        status: form.get('status') || undefined,
        description: form.get('description') || undefined,
        relatedCaseId: form.get('relatedCaseId') || undefined,
        relatedContractId: form.get('relatedContractId') || undefined,
      });
      router.push(`/notices/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create notice');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) return <LoadingState />;

  return (
    <div>
      <PageHeader title="New Notice" description="Record an incoming legal notice" />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="sender">Sender</label>
          <input id="sender" name="sender" required className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="receivedDate">Received Date</label>
            <input id="receivedDate" name="receivedDate" type="date" required className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="responseDeadline">Response Deadline</label>
            <input id="responseDeadline" name="responseDeadline" type="date" required className="w-full" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="w-full">
            {NOTICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={4} className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="relatedCaseId">Related Case</label>
            <select id="relatedCaseId" name="relatedCaseId" className="w-full">
              <option value="">None</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode} — {c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="relatedContractId">Related Contract</label>
            <select id="relatedContractId" name="relatedContractId" className="w-full">
              <option value="">None</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode} — {c.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Notice'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
