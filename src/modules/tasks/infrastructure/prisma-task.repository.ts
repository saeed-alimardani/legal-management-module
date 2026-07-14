import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateTaskInput,
  ListTasksFilters,
  ParentRef,
  TaskListScope,
  TaskWithParent,
  UpdateTaskInput,
} from '../domain/task.types';

const parentInclude = {
  legalCase: { select: { ownerId: true, deletedAt: true } },
  contract: { select: { ownerId: true, deletedAt: true } },
  notice: { select: { ownerId: true, deletedAt: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class PrismaTaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTaskInput): Promise<TaskWithParent> {
    return this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ?? null,
        caseId: input.caseId ?? null,
        contractId: input.contractId ?? null,
        noticeId: input.noticeId ?? null,
        createdById: input.createdById,
      },
      include: parentInclude,
    });
  }

  async findById(id: string): Promise<TaskWithParent | null> {
    return this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: parentInclude,
    });
  }

  async list(
    filters: ListTasksFilters,
    scope: TaskListScope,
  ): Promise<{ items: TaskWithParent[]; total: number }> {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...this.buildScopeWhere(scope),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.contractId ? { contractId: filters.contractId } : {}),
      ...(filters.noticeId ? { noticeId: filters.noticeId } : {}),
    };

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
        include: parentInclude,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, input: UpdateTaskInput): Promise<TaskWithParent> {
    return this.prisma.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.assigneeId !== undefined
          ? { assigneeId: input.assigneeId }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.completedAt !== undefined
          ? { completedAt: input.completedAt }
          : {}),
      },
      include: parentInclude,
    });
  }

  async softDelete(id: string): Promise<TaskWithParent> {
    return this.prisma.task.update({
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

  async userExistsAndActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });

    return user !== null;
  }

  private buildScopeWhere(scope: TaskListScope): Prisma.TaskWhereInput {
    if (!scope.counselUserId) {
      return {};
    }

    const userId = scope.counselUserId;

    return {
      OR: [
        { assigneeId: userId },
        { createdById: userId },
        { legalCase: { ownerId: userId, deletedAt: null } },
        { contract: { ownerId: userId, deletedAt: null } },
        { notice: { ownerId: userId, deletedAt: null } },
      ],
    };
  }
}
