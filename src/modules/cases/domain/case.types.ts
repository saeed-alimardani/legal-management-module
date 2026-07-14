import { CaseStatus, CaseType, PartyType, Priority } from '@prisma/client';

export interface CasePartyEntity {
  id: string;
  caseId: string;
  name: string;
  partyType: PartyType;
  contactInfo: string | null;
  notes: string | null;
}

export interface LegalCaseEntity {
  id: string;
  referenceCode: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  priority: Priority;
  ownerId: string;
  description: string | null;
  openedDate: Date | null;
  closedDate: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  parties?: CasePartyEntity[];
}

export interface CreateCasePartyInput {
  name: string;
  partyType: PartyType;
  contactInfo?: string | null;
  notes?: string | null;
}

export interface CreateCaseInput {
  referenceCode: string;
  title: string;
  type: CaseType;
  status: CaseStatus;
  priority: Priority;
  ownerId: string;
  description?: string | null;
  openedDate?: Date | null;
  closedDate?: Date | null;
  parties?: CreateCasePartyInput[];
}

export interface UpdateCaseInput {
  title?: string;
  type?: CaseType;
  status?: CaseStatus;
  priority?: Priority;
  description?: string | null;
  openedDate?: Date | null;
  closedDate?: Date | null;
}

export interface ListCasesFilters {
  status?: CaseStatus;
  type?: CaseType;
  ownerId?: string;
  page: number;
  limit: number;
}
