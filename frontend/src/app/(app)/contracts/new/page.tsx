'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/States';
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '@/lib/enums';
import { contractsApi } from '@/lib/services';

export default function NewContractPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const res = await contractsApi.create({
        title: form.get('title'),
        type: form.get('type'),
        status: form.get('status') || undefined,
        counterpartyName: form.get('counterpartyName'),
        effectiveDate: form.get('effectiveDate') || undefined,
        expirationDate: form.get('expirationDate') || undefined,
        renewalDate: form.get('renewalDate') || undefined,
        keyTerms: form.get('keyTerms') || undefined,
      });
      router.push(`/contracts/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contract');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Contract" description="Create a contract record" />
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="type">Type</label>
            <select id="type" name="type" required className="w-full">
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" className="w-full">
              {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="counterpartyName">Counterparty</label>
          <input id="counterpartyName" name="counterpartyName" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="keyTerms">Key Terms</label>
          <textarea id="keyTerms" name="keyTerms" rows={4} className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="effectiveDate">Effective Date</label>
            <input id="effectiveDate" name="effectiveDate" type="date" className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="expirationDate">Expiration Date</label>
            <input id="expirationDate" name="expirationDate" type="date" className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="renewalDate">Renewal Date</label>
            <input id="renewalDate" name="renewalDate" type="date" className="w-full" />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Contract'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
