import { Injectable } from '@nestjs/common';
import { DeadlineStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DeadlineView } from '../domain/deadline-view.enum';
import {
  CreateDeadlineInput,
  DeadlineListScope,
  DeadlineWithParent,
  ListDeadlinesFilters,
  ParentRef,
  UpdateDeadlineInput,
} from '../domain/deadline.types';

const parentInclude = {
  legalCase: { select: { ownerId: true, deletedAt: true } },
  contract: { select: { ownerId: true, deletedAt: true } },
  notice: { select: { ownerId: true, deletedAt: true } },
} satisfies Prisma.DeadlineInclude;

@Injectable()
export class PrismaDeadlineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDeadlineInput): Promise<DeadlineWithParent> {
    return this.prisma.deadline.create({
      data: {
        title: input.title,
        dueDate: input.dueDate,
        status: input.status,
        assigneeId: input.assigneeId ?? null,
        caseId: input.caseId ?? null,
        contractId: input.contractId ?? null,
        noticeId: input.noticeId ?? null,
        createdById: input.createdById,
      },
      include: parentInclude,
    });
  }

  async findById(id: string): Promise<DeadlineWithParent | null> {
    return this.prisma.deadline.findUnique({
      where: { id },
      include: parentInclude,
    });
  }

  async list(
    filters: ListDeadlinesFilters,
    scope: DeadlineListScope,
  ): Promise<{ items: DeadlineWithParent[]; total: number }> {
    const where: Prisma.DeadlineWhereInput = {
      ...this.buildScopeWhere(scope),
      ...this.buildViewWhere(filters),
    };

    const orderBy = this.buildOrderBy(filters.view);
    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.deadline.findMany({
        where,
        orderBy,
        skip,
        take: filters.limit,
        include: parentInclude,
      }),
      this.prisma.deadline.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: UpdateDeadlineInput,
  ): Promise<DeadlineWithParent> {
    return this.prisma.deadline.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.assigneeId !== undefined
          ? { assigneeId: input.assigneeId }
          : {}),
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
      },
      include: parentInclude,
    });
  }

  async cancel(id: string): Promise<DeadlineWithParent> {
    return this.prisma.deadline.update({
      where: { id },
      data: {
        status: DeadlineStatus.CANCELLED,
        completedAt: null,
      },
      include: parentInclude,
    });
  }

  async findParentOwner(
    parent: ParentRef,
  ): Promise<{ ownerId: string } | null> {
    if (parent.caseId) {
      const legalCase = await this.prisma.legalCase.findFirst({
        where: { id: parent.caseId, deletedAt: null },
        select: { ownerId: true },
      });
      return legalCase;
    }

    if (parent.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: parent.contractId, deletedAt: null },
        select: { ownerId: true },
      });
      return contract;
    }

    if (parent.noticeId) {
      const notice = await this.prisma.legalNotice.findFirst({
        where: { id: parent.noticeId, deletedAt: null },
        select: { ownerId: true },
      });
      return notice;
    }

    return null;
  }

  async userExistsAndActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });

    return user !== null;
  }

  private buildScopeWhere(
    scope: DeadlineListScope,
  ): Prisma.DeadlineWhereInput {
    if (!scope.counselUserId) {
      return {};
    }

    const userId = scope.counselUserId;

    return {
      OR: [
        { assigneeId: userId },
        { legalCase: { ownerId: userId, deletedAt: null } },
        { contract: { ownerId: userId, deletedAt: null } },
        { notice: { ownerId: userId, deletedAt: null } },
      ],
    };
  }

  private buildViewWhere(
    filters: ListDeadlinesFilters,
  ): Prisma.DeadlineWhereInput {
    switch (filters.view) {
      case DeadlineView.UPCOMING:
        return {
          status: DeadlineStatus.PENDING,
          dueDate: { gt: filters.today },
        };
      case DeadlineView.OVERDUE:
        return {
          status: DeadlineStatus.PENDING,
          dueDate: { lt: filters.today },
        };
      case DeadlineView.TODAY:
        return {
          status: DeadlineStatus.PENDING,
          dueDate: filters.today,
        };
      case DeadlineView.ASSIGNED_TO_ME:
        return {
          status: DeadlineStatus.PENDING,
          assigneeId: filters.currentUserId,
        };
      default:
        return {};
    }
  }

  private buildOrderBy(
    view?: DeadlineView,
  ): Prisma.DeadlineOrderByWithRelationInput {
    if (
      view === DeadlineView.UPCOMING ||
      view === DeadlineView.OVERDUE ||
      view === DeadlineView.TODAY
    ) {
      return { dueDate: 'asc' };
    }

    return { createdAt: 'desc' };
  }
}
