'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { PersianDateInput } from '@/components/PersianDateInput';
import { ErrorModal } from '@/components/ErrorModal';
import { ErrorState, LoadingState } from '@/components/States';
import { FINANCIAL_TYPES } from '@/lib/enums';
import { matterLabel, type ParentType } from '@/lib/lookups';
import { casesApi, contractsApi, financialRecordsApi } from '@/lib/services';
import type { Contract, LegalCase } from '@/lib/types';

type FinancialParentType = Extract<ParentType, 'case' | 'contract'>;

export default function NewFinancialRecordPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewFinancialRecordPageContent />
    </Suspense>
  );
}

function NewFinancialRecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadError, setLoadError] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const presetCaseId = searchParams.get('caseId');
  const presetContractId = searchParams.get('contractId');
  const [parentType, setParentType] = useState<FinancialParentType>(() =>
    presetContractId ? 'contract' : 'case',
  );
  const [parentId, setParentId] = useState(() =>
    presetCaseId ?? presetContractId ?? '',
  );
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
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoadingRefs(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError('');
    setSubmitting(true);

    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const selectedParentId = String(form.get('parentId') ?? '').trim();

    if (!selectedParentId) {
      setModalError('Please select a parent matter.');
      setSubmitting(false);
      return;
    }

    try {
      await financialRecordsApi.create({
        title: form.get('title'),
        type: form.get('type'),
        amount: Number(form.get('amount')),
        currency: form.get('currency') || 'IRR',
        recordDate: form.get('recordDate'),
        description: form.get('description') || undefined,
        caseId: parentType === 'case' ? selectedParentId : undefined,
        contractId: parentType === 'contract' ? selectedParentId : undefined,
      });
      if (parentType === 'case') router.push(`/cases/${selectedParentId}`);
      else if (parentType === 'contract') router.push(`/contracts/${selectedParentId}`);
      else router.push('/financial-records');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create record');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingRefs) return <LoadingState />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <>
      {modalError && (
        <ErrorModal message={modalError} onClose={() => setModalError('')} />
      )}
      <div>
        <PageHeader title="New Financial Record" description="Add an expense, invoice, or payment" />
        <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" name="title" required className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" required className="w-full">
                {FINANCIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="recordDate">Record Date</label>
              <PersianDateInput id="recordDate" name="recordDate" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="amount">Amount</label>
              <input id="amount" name="amount" type="number" min="0" step="0.01" required className="w-full" />
            </div>
            <div>
              <label className="label" htmlFor="currency">Currency</label>
              <input id="currency" name="currency" defaultValue="IRR" maxLength={3} className="w-full" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={3} className="w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="parentType">Parent Type</label>
              <select
                id="parentType"
                value={parentType}
                onChange={(e) => {
                  setParentType(e.target.value as FinancialParentType);
                  setParentId('');
                }}
                className="w-full"
              >
                <option value="case">Case</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="parentId">Parent Matter</label>
              <select
                id="parentId"
                name="parentId"
                required
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full"
              >
                <option value="">Select…</option>
                {parentType === 'case' && cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {matterLabel(c.referenceCode, c.title)}
                  </option>
                ))}
                {parentType === 'contract' && contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {matterLabel(c.referenceCode, c.title)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Record'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
