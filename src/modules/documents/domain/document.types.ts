import { DocumentType } from '@prisma/client';

export interface DocumentEntity {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  documentType: DocumentType;
  description: string | null;
  uploadedById: string;
  caseId: string | null;
  contractId: string | null;
  noticeId: string | null;
  deletedAt: Date | null;
  uploadedAt: Date;
}

export interface DocumentWithParent extends DocumentEntity {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
  notice?: { ownerId: string; deletedAt: Date | null } | null;
}

export type DocumentResponse = Omit<DocumentEntity, 'deletedAt'>;

export interface CreateDocumentInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  documentType: DocumentType;
  description?: string | null;
  uploadedById: string;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

export interface ListDocumentsFilters {
  caseId?: string;
  contractId?: string;
  noticeId?: string;
}

export interface DocumentListScope {
  counselUserId?: string;
}

export interface ParentRef {
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}
