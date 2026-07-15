'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorModal } from '@/components/ErrorModal';
import { ErrorState, LoadingState } from '@/components/States';
import { buildDiscussionContent } from '@/lib/discussion-content';
import { matterLabel, type ParentType } from '@/lib/lookups';
import {
  casesApi,
  contractsApi,
  discussionsApi,
  noticesApi,
} from '@/lib/services';
import type { Contract, LegalCase, LegalNotice } from '@/lib/types';

export default function NewDiscussionPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NewDiscussionPageContent />
    </Suspense>
  );
}

function NewDiscussionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadError, setLoadError] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const presetCaseId = searchParams.get('caseId');
  const presetContractId = searchParams.get('contractId');
  const presetNoticeId = searchParams.get('noticeId');
  const [parentType, setParentType] = useState<ParentType>(() => {
    if (presetContractId) return 'contract';
    if (presetNoticeId) return 'notice';
    return 'case';
  });
  const [parentId, setParentId] = useState(() =>
    presetCaseId ?? presetContractId ?? presetNoticeId ?? '',
  );
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notices, setNotices] = useState<LegalNotice[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  useEffect(() => {
    Promise.all([
      casesApi.list({ limit: 100 }),
      contractsApi.list({ limit: 100 }),
      noticesApi.list({ limit: 100 }),
    ])
      .then(([casesRes, contractsRes, noticesRes]) => {
        setCases(casesRes.data);
        setContracts(contractsRes.data);
        setNotices(noticesRes.data);
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
    const title = String(form.get('title') ?? '').trim();
    const body = String(form.get('body') ?? '').trim();
    const selectedParentId = String(form.get('parentId') ?? '').trim();

    if (!selectedParentId) {
      setModalError('Please select a parent matter.');
      setSubmitting(false);
      return;
    }

    const bodyPayload: Record<string, unknown> = {
      content: buildDiscussionContent(title, body),
    };
    if (parentType === 'case') bodyPayload.caseId = selectedParentId;
    else if (parentType === 'contract') bodyPayload.contractId = selectedParentId;
    else bodyPayload.noticeId = selectedParentId;

    try {
      await discussionsApi.create(bodyPayload);
      if (parentType === 'case') router.push(`/cases/${selectedParentId}`);
      else if (parentType === 'contract') router.push(`/contracts/${selectedParentId}`);
      else if (parentType === 'notice') router.push(`/notices/${selectedParentId}`);
      else router.push('/discussions');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to create discussion');
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
      <PageHeader title="New Discussion" description="Start a discussion on a matter" />
      <form className="card max-w-2xl space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" name="title" required className="w-full" />
        </div>
        <div>
          <label className="label" htmlFor="body">Body</label>
          <textarea id="body" name="body" rows={6} required className="w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="parentType">Parent Type</label>
            <select
              id="parentType"
              value={parentType}
              onChange={(e) => {
                setParentType(e.target.value as ParentType);
                setParentId('');
              }}
              className="w-full"
            >
              <option value="case">Case</option>
              <option value="contract">Contract</option>
              <option value="notice">Notice</option>
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
              {parentType === 'notice' && notices.map((n) => (
                <option key={n.id} value={n.id}>
                  {matterLabel(n.referenceCode, n.title)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Discussion'}
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
