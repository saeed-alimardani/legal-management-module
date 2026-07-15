import { FinancialRecordType, Prisma } from '@prisma/client';

export interface FinancialRecordEntity {
  id: string;
  title: string;
  amount: Prisma.Decimal;
  currency: string;
  type: FinancialRecordType;
  description: string | null;
  recordDate: Date;
  caseId: string | null;
  contractId: string | null;
  createdById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialRecordWithParent extends FinancialRecordEntity {
  legalCase?: { ownerId: string; deletedAt: Date | null } | null;
  contract?: { ownerId: string; deletedAt: Date | null } | null;
}

export type FinancialRecordResponse = Omit<
  FinancialRecordEntity,
  'deletedAt' | 'amount'
> & {
  amount: string;
  recordDatePersian: string;
  createdAtPersian: string;
  updatedAtPersian: string;
};

export interface CreateFinancialRecordInput {
  title: string;
  amount: Prisma.Decimal;
  currency: string;
  type: FinancialRecordType;
  description?: string | null;
  recordDate: Date;
  caseId?: string | null;
  contractId?: string | null;
  createdById: string;
}

export interface UpdateFinancialRecordInput {
  title?: string;
  amount?: Prisma.Decimal;
  currency?: string;
  type?: FinancialRecordType;
  description?: string | null;
  recordDate?: Date;
}

export interface ListFinancialRecordsFilters {
  caseId?: string;
  contractId?: string;
  type?: FinancialRecordType;
  page: number;
  limit: number;
}

export interface FinancialRecordListScope {
  ownerId?: string;
}

export interface ParentRef {
  caseId?: string | null;
  contractId?: string | null;
}
