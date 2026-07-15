import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateFinancialRecordInput,
  FinancialRecordListScope,
  FinancialRecordWithParent,
  ListFinancialRecordsFilters,
  ParentRef,
  UpdateFinancialRecordInput,
} from '../domain/financial-record.types';

const parentInclude = {
  legalCase: { select: { ownerId: true, deletedAt: true } },
  contract: { select: { ownerId: true, deletedAt: true } },
} satisfies Prisma.FinancialRecordInclude;

@Injectable()
export class PrismaFinancialRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateFinancialRecordInput,
  ): Promise<FinancialRecordWithParent> {
    return this.prisma.financialRecord.create({
      data: {
        title: input.title,
        amount: input.amount,
        currency: input.currency,
        type: input.type,
        description: input.description ?? null,
        recordDate: input.recordDate,
        caseId: input.caseId ?? null,
        contractId: input.contractId ?? null,
        createdById: input.createdById,
      },
      include: parentInclude,
    });
  }

  async findById(id: string): Promise<FinancialRecordWithParent | null> {
    return this.prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
      include: parentInclude,
    });
  }

  async list(
    filters: ListFinancialRecordsFilters,
    scope: FinancialRecordListScope,
  ): Promise<{ items: FinancialRecordWithParent[]; total: number }> {
    const where: Prisma.FinancialRecordWhereInput = {
      deletedAt: null,
      ...this.buildScopeWhere(scope),
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.contractId ? { contractId: filters.contractId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.financialRecord.findMany({
        where,
        orderBy: { recordDate: 'desc' },
        skip,
        take: filters.limit,
        include: parentInclude,
      }),
      this.prisma.financialRecord.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: UpdateFinancialRecordInput,
  ): Promise<FinancialRecordWithParent> {
    return this.prisma.financialRecord.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.recordDate !== undefined
          ? { recordDate: input.recordDate }
          : {}),
      },
      include: parentInclude,
    });
  }

  async softDelete(id: string): Promise<FinancialRecordWithParent> {
    return this.prisma.financialRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: parentInclude,
    });
  }

  async findParentOwner(
    parent: ParentRef,
  ): Promise<{ ownerId: string } | null> {
    if (parent.caseId) {
      return this.prisma.legalCase.findFirst({
        where: { id: parent.caseId, deletedAt: null },
        select: { ownerId: true },
      });
    }

    if (parent.contractId) {
      return this.prisma.contract.findFirst({
        where: { id: parent.contractId, deletedAt: null },
        select: { ownerId: true },
      });
    }

    return null;
  }

  private buildScopeWhere(
    scope: FinancialRecordListScope,
  ): Prisma.FinancialRecordWhereInput {
    if (!scope.ownerId) {
      return {};
    }

    const ownerId = scope.ownerId;

    return {
      OR: [
        { legalCase: { ownerId, deletedAt: null } },
        { contract: { ownerId, deletedAt: null } },
      ],
    };
  }
}
