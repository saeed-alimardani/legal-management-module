'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatPersianDate } from '@/lib/date';
import { FINANCIAL_TYPES } from '@/lib/enums';
import type { ParentType } from '@/lib/lookups';
import { financialRecordsApi } from '@/lib/services';
import type { FinancialRecord } from '@/lib/types';

type FinancialParentType = Extract<ParentType, 'case' | 'contract'>;

interface MatterFinancialRecordsSectionProps {
  parentType: FinancialParentType;
  parentId: string;
  canEdit: boolean;
  onError: (message: string) => void;
}

function listParams(parentType: FinancialParentType, parentId: string) {
  if (parentType === 'case') return { caseId: parentId, limit: 50 };
  return { contractId: parentId, limit: 50 };
}

function createPayload(
  parentType: FinancialParentType,
  parentId: string,
  form: FormData,
) {
  return {
    title: form.get('title'),
    type: form.get('type'),
    amount: Number(form.get('amount')),
    currency: form.get('currency') || 'IRR',
    recordDate: form.get('recordDate'),
    description: form.get('description') || undefined,
    caseId: parentType === 'case' ? parentId : undefined,
    contractId: parentType === 'contract' ? parentId : undefined,
  };
}

function updatePayload(form: FormData) {
  return {
    title: form.get('title'),
    type: form.get('type'),
    amount: Number(form.get('amount')),
    currency: form.get('currency') || 'IRR',
    recordDate: form.get('recordDate'),
    description: form.get('description') || null,
  };
}

export function MatterFinancialRecordsSection({
  parentType,
  parentId,
  canEdit,
  onError,
}: MatterFinancialRecordsSectionProps) {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financialRecordsApi.list(listParams(parentType, parentId));
      setRecords(res.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load financial records');
    } finally {
      setLoading(false);
    }
  }, [parentType, parentId, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      const res = await financialRecordsApi.create(createPayload(parentType, parentId, form));
      formEl.reset();
      setRecords((prev) => [res.data, ...prev]);
      setShowAddForm(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add financial record');
    }
  }

  async function handleUpdate(recordId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      const res = await financialRecordsApi.update(recordId, updatePayload(form));
      formEl.reset();
      setRecords((prev) =>
        prev.map((item) => (item.id === recordId ? res.data : item)),
      );
      setEditingId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update financial record');
    }
  }

  async function handleDelete(record: FinancialRecord) {
    if (!confirm(`Delete financial record "${record.title}"?`)) return;
    try {
      await financialRecordsApi.delete(record.id);
      setRecords((prev) => prev.filter((item) => item.id !== record.id));
      if (editingId === record.id) setEditingId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete financial record');
    }
  }

  function renderFinancialForm(
    record: FinancialRecord | null,
    onSubmit: (event: FormEvent<HTMLFormElement>) => void,
    onCancel: () => void,
    submitLabel: string,
    formId: string,
  ) {
    return (
      <form className="card grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${formId}-title`}>Title</label>
          <input
            id={`${formId}-title`}
            name="title"
            defaultValue={record?.title ?? ''}
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${formId}-type`}>Type</label>
          <select id={`${formId}-type`} name="type" defaultValue={record?.type ?? FINANCIAL_TYPES[0]} required className="w-full">
            {FINANCIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${formId}-recordDate`}>Record Date</label>
          <input
            id={`${formId}-recordDate`}
            name="recordDate"
            type="date"
            defaultValue={record?.recordDate?.slice(0, 10) ?? ''}
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${formId}-amount`}>Amount</label>
          <input
            id={`${formId}-amount`}
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={record?.amount ?? ''}
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${formId}-currency`}>Currency</label>
          <input
            id={`${formId}-currency`}
            name="currency"
            defaultValue={record?.currency ?? 'IRR'}
            maxLength={3}
            className="w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`${formId}-description`}>Description</label>
          <textarea
            id={`${formId}-description`}
            name="description"
            rows={2}
            defaultValue={record?.description ?? ''}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary">{submitLabel}</button>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Financial Records</h3>
        {canEdit && (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setShowAddForm((open) => !open);
              setEditingId(null);
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Record'}
          </button>
        )}
      </div>

      {showAddForm && canEdit && renderFinancialForm(
        null,
        handleAdd,
        () => setShowAddForm(false),
        'Add Record',
        'financial-add',
      )}

      {editingId && canEdit && (() => {
        const record = records.find((item) => item.id === editingId);
        if (!record) return null;
        return renderFinancialForm(
          record,
          (event) => void handleUpdate(record.id, event),
          () => setEditingId(null),
          'Save Changes',
          `financial-edit-${record.id}`,
        );
      })()}

      {loading ? (
        <p className="text-sm text-slate-500">Loading financial records...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-slate-500">No financial records yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Type</th><th>Amount</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.title}</td>
                  <td>{record.type}</td>
                  <td>{record.amount} {record.currency}</td>
                  <td>{formatPersianDate(record.recordDate, record.recordDatePersian)}</td>
                  <td className="space-x-3">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="text-brand-600"
                          onClick={() => {
                            setEditingId(record.id);
                            setShowAddForm(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => void handleDelete(record)}
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
    </section>
  );
}
