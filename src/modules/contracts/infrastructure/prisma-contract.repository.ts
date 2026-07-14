import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  formatReferenceCode,
  getNextReferenceSequence,
  REFERENCE_CODE_PREFIX,
} from '../../../shared/utils/reference-code.util';
import {
  ContractEntity,
  CreateContractInput,
  ListContractsFilters,
  UpdateContractInput,
} from '../domain/contract.types';

@Injectable()
export class PrismaContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = REFERENCE_CODE_PREFIX.CONTRACT;
    const pattern = `${prefix}-${year}-`;

    const latest = await this.prisma.contract.findFirst({
      where: {
        referenceCode: { startsWith: pattern },
      },
      orderBy: { referenceCode: 'desc' },
      select: { referenceCode: true },
    });

    const sequence = getNextReferenceSequence(
      latest?.referenceCode,
      prefix,
      year,
    );

    return formatReferenceCode(prefix, sequence, year);
  }

  async create(input: CreateContractInput): Promise<ContractEntity> {
    return this.prisma.contract.create({
      data: {
        referenceCode: input.referenceCode,
        title: input.title,
        type: input.type,
        status: input.status,
        ownerId: input.ownerId,
        counterpartyName: input.counterpartyName,
        effectiveDate: input.effectiveDate ?? null,
        expirationDate: input.expirationDate ?? null,
        renewalDate: input.renewalDate ?? null,
        keyTerms: input.keyTerms ?? null,
      },
    });
  }

  async findById(id: string): Promise<ContractEntity | null> {
    return this.prisma.contract.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async list(
    filters: ListContractsFilters,
    scope: Prisma.ContractWhereInput,
  ): Promise<{ items: ContractEntity[]; total: number }> {
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...scope,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: UpdateContractInput,
  ): Promise<ContractEntity> {
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.counterpartyName !== undefined
          ? { counterpartyName: input.counterpartyName }
          : {}),
        ...(input.effectiveDate !== undefined
          ? { effectiveDate: input.effectiveDate }
          : {}),
        ...(input.expirationDate !== undefined
          ? { expirationDate: input.expirationDate }
          : {}),
        ...(input.renewalDate !== undefined
          ? { renewalDate: input.renewalDate }
          : {}),
        ...(input.keyTerms !== undefined ? { keyTerms: input.keyTerms } : {}),
      },
    });
  }

  async softDelete(id: string): Promise<ContractEntity> {
    return this.prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reassign(id: string, ownerId: string): Promise<ContractEntity> {
    return this.prisma.contract.update({
      where: { id },
      data: { ownerId },
    });
  }

  async userExistsAndActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
      select: { id: true },
    });

    return user !== null;
  }
}
