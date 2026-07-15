'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatPersianDate } from '@/lib/date';
import { FINANCIAL_TYPES } from '@/lib/enums';
import { matterLabel, type ParentType } from '@/lib/lookups';
import { canCreateMatterContent } from '@/lib/rbac';
import { casesApi, contractsApi, financialRecordsApi } from '@/lib/services';
import type { Contract, FinancialRecord, LegalCase } from '@/lib/types';

type FinancialParentType = Extract<ParentType, 'case' | 'contract'>;

export default function FinancialRecordsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FinancialRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [parentType, setParentType] = useState<FinancialParentType | ''>('');
  const [parentId, setParentId] = useState('');
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string | number | undefined> = {
      page,
      limit: 20,
      type: type || undefined,
    };
    if (parentType === 'case' && parentId) params.caseId = parentId;
    else if (parentType === 'contract' && parentId) params.contractId = parentId;

    financialRecordsApi
      .list(params)
      .then((res) => {
        setItems(res.data);
        setMeta(res.meta);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, type, parentType, parentId]);

  function parentLabel(item: FinancialRecord): string {
    if (item.caseId) {
      const c = cases.find((x) => x.id === item.caseId);
      return c ? `Case: ${matterLabel(c.referenceCode, c.title)}` : 'Case';
    }
    if (item.contractId) {
      const c = contracts.find((x) => x.id === item.contractId);
      return c ? `Contract: ${matterLabel(c.referenceCode, c.title)}` : 'Contract';
    }
    return '—';
  }

  if (loadingRefs) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Financial Records"
        description="Track expenses, invoices, and payments"
        action={
          user && canCreateMatterContent(user.role) ? (
            <Link href="/financial-records/new" className="btn-primary">
              New Record
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {FINANCIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={parentType}
          onChange={(e) => {
            setParentType(e.target.value as FinancialParentType | '');
            setParentId('');
            setPage(1);
          }}
        >
          <option value="">All matters</option>
          <option value="case">Case</option>
          <option value="contract">Contract</option>
        </select>
        <select
          value={parentId}
          onChange={(e) => { setParentId(e.target.value); setPage(1); }}
          disabled={!parentType}
          className="min-w-[200px]"
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
        </select>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No financial records found." />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Parent</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td><span className="badge-gray">{item.type}</span></td>
                  <td>{formatCurrency(item.amount, item.currency)}</td>
                  <td>{formatPersianDate(item.recordDate, item.recordDatePersian)}</td>
                  <td className="text-sm text-slate-500">{parentLabel(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
