import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { buildCounselNoticeWhere } from '../../../shared/access-control/counsel-involvement.where';
import {
  formatReferenceCode,
  getNextReferenceSequence,
  REFERENCE_CODE_PREFIX,
} from '../../../shared/utils/reference-code.util';
import {
  CreateNoticeInput,
  LegalNoticeEntity,
  ListNoticesFilters,
  UpdateNoticeInput,
} from '../domain/notice.types';

@Injectable()
export class PrismaNoticeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = REFERENCE_CODE_PREFIX.NOTICE;
    const pattern = `${prefix}-${year}-`;

    const latest = await this.prisma.legalNotice.findFirst({
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

  async create(input: CreateNoticeInput): Promise<LegalNoticeEntity> {
    return this.prisma.legalNotice.create({
      data: {
        referenceCode: input.referenceCode,
        title: input.title,
        sender: input.sender,
        receivedDate: input.receivedDate,
        responseDeadline: input.responseDeadline,
        status: input.status,
        ownerId: input.ownerId,
        description: input.description ?? null,
        relatedCaseId: input.relatedCaseId ?? null,
        relatedContractId: input.relatedContractId ?? null,
      },
    });
  }

  async findById(id: string): Promise<LegalNoticeEntity | null> {
    return this.prisma.legalNotice.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async isUserInvolved(noticeId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.legalNotice.count({
      where: {
        id: noticeId,
        deletedAt: null,
        ...buildCounselNoticeWhere(userId),
      },
    });

    return count > 0;
  }

  async list(
    filters: ListNoticesFilters,
    scope: Prisma.LegalNoticeWhereInput,
  ): Promise<{ items: LegalNoticeEntity[]; total: number }> {
    const where: Prisma.LegalNoticeWhereInput = {
      deletedAt: null,
      ...scope,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.legalNotice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.legalNotice.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: UpdateNoticeInput,
  ): Promise<LegalNoticeEntity> {
    return this.prisma.legalNotice.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.sender !== undefined ? { sender: input.sender } : {}),
        ...(input.receivedDate !== undefined
          ? { receivedDate: input.receivedDate }
          : {}),
        ...(input.responseDeadline !== undefined
          ? { responseDeadline: input.responseDeadline }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.relatedCaseId !== undefined
          ? { relatedCaseId: input.relatedCaseId }
          : {}),
        ...(input.relatedContractId !== undefined
          ? { relatedContractId: input.relatedContractId }
          : {}),
      },
    });
  }

  async softDelete(id: string): Promise<LegalNoticeEntity> {
    return this.prisma.legalNotice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reassign(id: string, ownerId: string): Promise<LegalNoticeEntity> {
    return this.prisma.legalNotice.update({
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

  async relatedCaseExists(caseId: string): Promise<boolean> {
    const legalCase = await this.prisma.legalCase.findFirst({
      where: {
        id: caseId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return legalCase !== null;
  }

  async relatedContractExists(contractId: string): Promise<boolean> {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return contract !== null;
  }
}
