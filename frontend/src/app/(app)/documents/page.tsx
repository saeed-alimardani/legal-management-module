'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ErrorModal } from '@/components/ErrorModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatBytes, formatDateTime } from '@/lib/date';
import { DOCUMENT_TYPES } from '@/lib/enums';
import { matterLabel, type ParentType } from '@/lib/lookups';
import { canCreateMatterContent } from '@/lib/rbac';
import {
  casesApi,
  contractsApi,
  documentsApi,
  noticesApi,
} from '@/lib/services';
import type { Contract, Document, LegalCase, LegalNotice } from '@/lib/types';

export default function DocumentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DocumentsPageContent />
    </Suspense>
  );
}

function DocumentsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [parentType, setParentType] = useState<ParentType>(() => {
    if (searchParams.get('contractId')) return 'contract';
    if (searchParams.get('noticeId')) return 'notice';
    return 'case';
  });
  const [parentId, setParentId] = useState(() =>
    searchParams.get('caseId')
    ?? searchParams.get('contractId')
    ?? searchParams.get('noticeId')
    ?? '',
  );
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notices, setNotices] = useState<LegalNotice[]>([]);
  const [items, setItems] = useState<Document[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

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
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingRefs(false));
  }, []);

  useEffect(() => {
    if (!parentId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError('');
    const params: Record<string, string> = {};
    if (parentType === 'case') params.caseId = parentId;
    else if (parentType === 'contract') params.contractId = parentId;
    else params.noticeId = parentId;

    documentsApi
      .list(params)
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [parentId, parentType]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parentId) {
      setUploadError('Select a parent matter before uploading.');
      return;
    }

    setUploadError('');
    setUploading(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    if (parentType === 'case') form.set('caseId', parentId);
    else if (parentType === 'contract') form.set('contractId', parentId);
    else form.set('noticeId', parentId);

    const listParams: Record<string, string> = {};
    if (parentType === 'case') listParams.caseId = parentId;
    else if (parentType === 'contract') listParams.contractId = parentId;
    else listParams.noticeId = parentId;

    try {
      await documentsApi.upload(form);
      formEl.reset();
      const res = await documentsApi.list(listParams);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (loadingRefs) return <LoadingState />;

  return (
    <div>
      {(uploadError || error) && (
        <ErrorModal
          message={uploadError || error}
          onClose={() => {
            setUploadError('');
            setError('');
          }}
        />
      )}
      <PageHeader
        title="Documents"
        description="List and upload documents by parent matter"
      />

      <div className="card mb-4 grid gap-3 sm:grid-cols-2">
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

      {user && canCreateMatterContent(user.role) && (
        <form className="card mb-4 flex flex-wrap gap-3" onSubmit={handleUpload}>
          <input name="file" type="file" required />
          <select name="documentType" required>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input name="description" placeholder="Description" />
          <button type="submit" className="btn-primary" disabled={uploading || !parentId}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      )}
      {!parentId && (
        <EmptyState message="Select a case, contract, or notice to list documents." />
      )}
      {parentId && loading && <LoadingState />}
      {parentId && !loading && items.length === 0 && (
        <EmptyState message="No documents found for this matter." />
      )}
      {parentId && !loading && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.fileName}</td>
                  <td><span className="badge-gray">{doc.documentType}</span></td>
                  <td>{formatBytes(doc.fileSize)}</td>
                  <td>{formatDateTime(doc.uploadedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="text-brand-600"
                      onClick={() => documentsApi.download(doc.id, doc.fileName)}
                    >
                      Download
                    </button>
                    {user && canCreateMatterContent(user.role) && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={async () => {
                            if (!confirm(`Delete "${doc.fileName}"?`)) return;
                            try {
                              await documentsApi.delete(doc.id);
                              setItems((prev) => prev.filter((item) => item.id !== doc.id));
                            } catch (err) {
                              setUploadError(err instanceof Error ? err.message : 'Delete failed');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
