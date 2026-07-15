'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatBytes } from '@/lib/date';
import { DOCUMENT_TYPES } from '@/lib/enums';
import type { ParentType } from '@/lib/lookups';
import { documentsApi } from '@/lib/services';
import type { Document } from '@/lib/types';

interface MatterDocumentsSectionProps {
  parentType: ParentType;
  parentId: string;
  canEdit: boolean;
  onError: (message: string) => void;
}

function listParams(parentType: ParentType, parentId: string) {
  if (parentType === 'case') return { caseId: parentId };
  if (parentType === 'contract') return { contractId: parentId };
  return { noticeId: parentId };
}

export function MatterDocumentsSection({
  parentType,
  parentId,
  canEdit,
  onError,
}: MatterDocumentsSectionProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list(listParams(parentType, parentId));
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [parentType, parentId, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    if (parentType === 'case') form.set('caseId', parentId);
    else if (parentType === 'contract') form.set('contractId', parentId);
    else form.set('noticeId', parentId);

    try {
      await documentsApi.upload(form);
      formEl.reset();
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;
    try {
      await documentsApi.delete(doc.id);
      setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Documents</h3>
      {canEdit && (
        <form className="card flex flex-wrap gap-3" onSubmit={handleUpload}>
          <input name="file" type="file" required />
          <select name="documentType" required>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input name="description" placeholder="Description" />
          <button type="submit" className="btn-primary">Upload</button>
        </form>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>File</th><th>Type</th><th>Size</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.fileName}</td>
                  <td>{doc.documentType}</td>
                  <td>{formatBytes(doc.fileSize)}</td>
                  <td className="space-x-3">
                    <button
                      type="button"
                      className="text-brand-600"
                      onClick={() => documentsApi.download(doc.id, doc.fileName)}
                    >
                      Download
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => void handleDelete(doc)}
                      >
                        Delete
                      </button>
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
