import { ContractStatus, ContractType } from '@prisma/client';

export interface ContractEntity {
  id: string;
  referenceCode: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  ownerId: string;
  counterpartyName: string;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  renewalDate: Date | null;
  keyTerms: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContractInput {
  referenceCode: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  ownerId: string;
  counterpartyName: string;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  renewalDate?: Date | null;
  keyTerms?: string | null;
}

export interface UpdateContractInput {
  title?: string;
  type?: ContractType;
  status?: ContractStatus;
  counterpartyName?: string;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  renewalDate?: Date | null;
  keyTerms?: string | null;
}

export interface ListContractsFilters {
  status?: ContractStatus;
  type?: ContractType;
  ownerId?: string;
  page: number;
  limit: number;
}
