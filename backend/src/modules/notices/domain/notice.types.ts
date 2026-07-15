import { NoticeStatus } from '@prisma/client';

export interface LegalNoticeEntity {
  id: string;
  referenceCode: string;
  title: string;
  sender: string;
  receivedDate: Date;
  responseDeadline: Date;
  status: NoticeStatus;
  ownerId: string;
  description: string | null;
  relatedCaseId: string | null;
  relatedContractId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoticeResponse extends LegalNoticeEntity {
  receivedDatePersian: string;
  responseDeadlinePersian: string;
  createdAtPersian: string;
  updatedAtPersian: string;
}

export interface CreateNoticeInput {
  referenceCode: string;
  title: string;
  sender: string;
  receivedDate: Date;
  responseDeadline: Date;
  status: NoticeStatus;
  ownerId: string;
  description?: string | null;
  relatedCaseId?: string | null;
  relatedContractId?: string | null;
}

export interface UpdateNoticeInput {
  title?: string;
  sender?: string;
  receivedDate?: Date;
  responseDeadline?: Date;
  status?: NoticeStatus;
  description?: string | null;
  relatedCaseId?: string | null;
  relatedContractId?: string | null;
}

export interface ListNoticesFilters {
  status?: NoticeStatus;
  ownerId?: string;
  page: number;
  limit: number;
}
