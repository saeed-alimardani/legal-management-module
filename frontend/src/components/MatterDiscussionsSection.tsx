'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/date';
import {
  buildDiscussionContent,
  parseDiscussionContent,
} from '@/lib/discussion-content';
import type { ParentType } from '@/lib/lookups';
import { userName } from '@/lib/lookups';
import { discussionsApi } from '@/lib/services';
import type { Discussion } from '@/lib/types';

interface MatterDiscussionsSectionProps {
  parentType: ParentType;
  parentId: string;
  canEdit: boolean;
  userNames: Map<string, string>;
  onError: (message: string) => void;
}

function listParams(parentType: ParentType, parentId: string) {
  if (parentType === 'case') return { caseId: parentId, limit: 50 };
  if (parentType === 'contract') return { contractId: parentId, limit: 50 };
  return { noticeId: parentId, limit: 50 };
}

function createPayload(parentType: ParentType, parentId: string, content: string) {
  if (parentType === 'case') return { caseId: parentId, content };
  if (parentType === 'contract') return { contractId: parentId, content };
  return { noticeId: parentId, content };
}

export function MatterDiscussionsSection({
  parentType,
  parentId,
  canEdit,
  userNames,
  onError,
}: MatterDiscussionsSectionProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discussionsApi.list(listParams(parentType, parentId));
      setDiscussions(res.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load discussions');
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
    const title = String(form.get('title') ?? '').trim();
    const body = String(form.get('body') ?? '').trim();

    try {
      const res = await discussionsApi.create(
        createPayload(parentType, parentId, buildDiscussionContent(title, body)),
      );
      formEl.reset();
      setDiscussions((prev) => [res.data, ...prev]);
      setShowAddForm(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add discussion');
    }
  }

  async function handleUpdate(
    discussionId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const title = String(form.get('title') ?? '').trim();
    const body = String(form.get('body') ?? '').trim();

    try {
      const res = await discussionsApi.update(discussionId, {
        content: buildDiscussionContent(title, body),
      });
      formEl.reset();
      setDiscussions((prev) =>
        prev.map((item) => (item.id === discussionId ? res.data : item)),
      );
      setEditingId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update discussion');
    }
  }

  async function handleDelete(discussion: Discussion) {
    const { title } = parseDiscussionContent(discussion.content);
    if (!confirm(`Delete discussion "${title}"?`)) return;
    try {
      await discussionsApi.delete(discussion.id);
      setDiscussions((prev) => prev.filter((item) => item.id !== discussion.id));
      if (editingId === discussion.id) setEditingId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete discussion');
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Discussions</h3>
        {canEdit && (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setShowAddForm((open) => !open);
              setEditingId(null);
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Discussion'}
          </button>
        )}
      </div>

      {showAddForm && canEdit && (
        <form className="card space-y-4" onSubmit={handleAdd}>
          <div>
            <label className="label" htmlFor="discussion-add-title">Title</label>
            <input id="discussion-add-title" name="title" required className="w-full" />
          </div>
          <div>
            <label className="label" htmlFor="discussion-add-body">Body</label>
            <textarea id="discussion-add-body" name="body" rows={4} required className="w-full" />
          </div>
          <button type="submit" className="btn-primary">Add Discussion</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading discussions...</p>
      ) : discussions.length === 0 ? (
        <p className="text-sm text-slate-500">No discussions yet.</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((discussion) => {
            const parsed = parseDiscussionContent(discussion.content);
            const isEditing = editingId === discussion.id;

            if (isEditing && canEdit) {
              return (
                <form
                  key={discussion.id}
                  className="card space-y-4"
                  onSubmit={(event) => void handleUpdate(discussion.id, event)}
                >
                  <div>
                    <label className="label" htmlFor={`discussion-edit-title-${discussion.id}`}>
                      Title
                    </label>
                    <input
                      id={`discussion-edit-title-${discussion.id}`}
                      name="title"
                      defaultValue={parsed.title}
                      required
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`discussion-edit-body-${discussion.id}`}>
                      Body
                    </label>
                    <textarea
                      id={`discussion-edit-body-${discussion.id}`}
                      name="body"
                      rows={4}
                      defaultValue={parsed.body}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary">Save</button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div key={discussion.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{parsed.title}</p>
                  {canEdit && (
                    <div className="flex gap-3 text-sm">
                      <button
                        type="button"
                        className="text-brand-600"
                        onClick={() => {
                          setEditingId(discussion.id);
                          setShowAddForm(false);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => void handleDelete(discussion)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{parsed.body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {userName(userNames, discussion.authorId)} · {formatDateTime(discussion.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
