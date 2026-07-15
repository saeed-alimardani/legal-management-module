import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { buildCounselDiscussionWhere } from '../../../shared/access-control/counsel-involvement.where';
import {
  CreateDiscussionInput,
  DiscussionListScope,
  DiscussionWithParent,
  ListDiscussionsFilters,
  ParentRef,
  UpdateDiscussionInput,
} from '../domain/discussion.types';

const parentInclude = {
  legalCase: { select: { ownerId: true, deletedAt: true } },
  contract: { select: { ownerId: true, deletedAt: true } },
  notice: { select: { ownerId: true, deletedAt: true } },
} satisfies Prisma.DiscussionInclude;

@Injectable()
export class PrismaDiscussionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDiscussionInput): Promise<DiscussionWithParent> {
    return this.prisma.discussion.create({
      data: {
        content: input.content,
        authorId: input.authorId,
        caseId: input.caseId ?? null,
        contractId: input.contractId ?? null,
        noticeId: input.noticeId ?? null,
      },
      include: parentInclude,
    });
  }

  async findById(id: string): Promise<DiscussionWithParent | null> {
    return this.prisma.discussion.findFirst({
      where: { id, deletedAt: null },
      include: parentInclude,
    });
  }

  async isUserInvolved(discussionId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.discussion.count({
      where: {
        id: discussionId,
        deletedAt: null,
        ...buildCounselDiscussionWhere(userId),
      },
    });

    return count > 0;
  }

  async list(
    filters: ListDiscussionsFilters,
    scope: DiscussionListScope,
  ): Promise<{ items: DiscussionWithParent[]; total: number }> {
    const where: Prisma.DiscussionWhereInput = {
      deletedAt: null,
      ...this.buildScopeWhere(scope),
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.contractId ? { contractId: filters.contractId } : {}),
      ...(filters.noticeId ? { noticeId: filters.noticeId } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.discussion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
        include: parentInclude,
      }),
      this.prisma.discussion.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: UpdateDiscussionInput,
  ): Promise<DiscussionWithParent> {
    return this.prisma.discussion.update({
      where: { id },
      data: {
        ...(input.content !== undefined ? { content: input.content } : {}),
      },
      include: parentInclude,
    });
  }

  async softDelete(id: string): Promise<DiscussionWithParent> {
    return this.prisma.discussion.update({
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

    if (parent.noticeId) {
      return this.prisma.legalNotice.findFirst({
        where: { id: parent.noticeId, deletedAt: null },
        select: { ownerId: true },
      });
    }

    return null;
  }

  private buildScopeWhere(
    scope: DiscussionListScope,
  ): Prisma.DiscussionWhereInput {
    if (!scope.counselUserId) {
      return {};
    }

    return buildCounselDiscussionWhere(scope.counselUserId);
  }
}
