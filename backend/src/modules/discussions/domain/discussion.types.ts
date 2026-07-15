export interface DiscussionEntity {
  id: string;
  content: string;
  authorId: string;
  caseId: string | null;
  contractId: string | null;
  noticeId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionWithParent extends DiscussionEntity {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}

export type DiscussionResponse = Omit<DiscussionEntity, 'deletedAt'> & {
  createdAtPersian: string;
  updatedAtPersian: string;
};

export interface CreateDiscussionInput {
  content: string;
  authorId: string;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

export interface UpdateDiscussionInput {
  content?: string;
}

export interface ListDiscussionsFilters {
  caseId?: string;
  contractId?: string;
  noticeId?: string;
  page: number;
  limit: number;
}

export interface DiscussionListScope {
  counselUserId?: string;
}

export interface ParentRef {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}
