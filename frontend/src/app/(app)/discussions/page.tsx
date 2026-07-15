'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/date';
import {
  buildMatterMaps,
  matterLabel,
  parentMatterLabel,
  type ParentType,
} from '@/lib/lookups';
import { canCreateMatterContent } from '@/lib/rbac';
import {
  casesApi,
  contractsApi,
  discussionsApi,
  noticesApi,
} from '@/lib/services';
import type { Contract, Discussion, LegalCase, LegalNotice } from '@/lib/types';

function parseDiscussionContent(content: string): { title: string; body: string } {
  const separator = content.indexOf('\n\n');
  if (separator === -1) {
    return { title: content.slice(0, 80), body: content };
  }
  return {
    title: content.slice(0, separator),
    body: content.slice(separator + 2),
  };
}

export default function DiscussionsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Discussion[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [parentType, setParentType] = useState<ParentType | ''>('');
  const [parentId, setParentId] = useState('');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notices, setNotices] = useState<LegalNotice[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    setLoading(true);
    const params: Record<string, string | number | undefined> = { page, limit: 20 };
    if (parentType === 'case' && parentId) params.caseId = parentId;
    else if (parentType === 'contract' && parentId) params.contractId = parentId;
    else if (parentType === 'notice' && parentId) params.noticeId = parentId;

    discussionsApi
      .list(params)
      .then((res) => {
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, parentType, parentId]);

  const matterMaps = buildMatterMaps(cases, contracts, notices);

  if (loadingRefs) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Discussions"
        description="Internal notes and conversations on legal matters"
        action={
          user && canCreateMatterContent(user.role) ? (
            <Link href="/discussions/new" className="btn-primary">
              New Discussion
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <select
          value={parentType}
          onChange={(e) => {
            setParentType(e.target.value as ParentType | '');
            setParentId('');
            setPage(1);
          }}
          className="w-full"
        >
          <option value="">All matters</option>
          <option value="case">Case</option>
          <option value="contract">Contract</option>
          <option value="notice">Notice</option>
        </select>
        <select
          value={parentId}
          onChange={(e) => { setParentId(e.target.value); setPage(1); }}
          disabled={!parentType}
          className="w-full"
        >
          <option value="">All {parentType || 'matters'}</option>
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

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No discussions found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const { title, body } = parseDiscussionContent(item.content);
            return (
              <div key={item.id} className="card">
                <p className="font-medium">{title}</p>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {formatDateTime(item.createdAt)}
                  {' · '}
                  {parentMatterLabel(matterMaps, item)}
                </p>
              </div>
            );
          })}
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
