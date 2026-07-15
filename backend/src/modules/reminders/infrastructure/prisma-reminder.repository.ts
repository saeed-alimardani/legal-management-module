import { Injectable } from '@nestjs/common';
import { Prisma, ReminderStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReminderView } from '../domain/reminder-view.enum';
import {
  CreateReminderInput,
  ListRemindersFilters,
  ReminderListScope,
  ReminderWithDeadline,
  UpdateReminderInput,
} from '../domain/reminder.types';

const deadlineInclude = {
  legalCase: { select: { ownerId: true, deletedAt: true } },
  contract: { select: { ownerId: true, deletedAt: true } },
  notice: { select: { ownerId: true, deletedAt: true } },
} satisfies Prisma.DeadlineInclude;

const reminderInclude = {
  deadline: { include: deadlineInclude },
} satisfies Prisma.ReminderInclude;

@Injectable()
export class PrismaReminderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReminderInput): Promise<ReminderWithDeadline> {
    return this.prisma.reminder.create({
      data: {
        deadlineId: input.deadlineId,
        remindAt: input.remindAt,
        status: input.status,
        message: input.message ?? null,
        createdById: input.createdById,
      },
      include: reminderInclude,
    });
  }

  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    input: CreateReminderInput,
  ): Promise<ReminderWithDeadline> {
    return tx.reminder.create({
      data: {
        deadlineId: input.deadlineId,
        remindAt: input.remindAt,
        status: input.status,
        message: input.message ?? null,
        createdById: input.createdById,
      },
      include: reminderInclude,
    });
  }

  async findById(id: string): Promise<ReminderWithDeadline | null> {
    return this.prisma.reminder.findUnique({
      where: { id },
      include: reminderInclude,
    });
  }

  async list(
    filters: ListRemindersFilters,
    scope: ReminderListScope,
  ): Promise<{ items: ReminderWithDeadline[]; total: number }> {
    const where: Prisma.ReminderWhereInput = {
      ...this.buildScopeWhere(scope),
      ...this.buildViewWhere(filters),
    };

    const orderBy = this.buildOrderBy(filters.view, filters.status);
    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        orderBy,
        skip,
        take: filters.limit,
        include: reminderInclude,
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    input: UpdateReminderInput,
  ): Promise<ReminderWithDeadline> {
    return this.prisma.reminder.update({
      where: { id },
      data: {
        ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sentAt !== undefined ? { sentAt: input.sentAt } : {}),
      },
      include: reminderInclude,
    });
  }

  async findDuePending(now: Date): Promise<ReminderWithDeadline[]> {
    return this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.PENDING,
        remindAt: { lte: now },
      },
      include: reminderInclude,
      orderBy: { remindAt: 'asc' },
    });
  }

  async markSent(id: string, sentAt: Date): Promise<ReminderWithDeadline> {
    return this.update(id, {
      status: ReminderStatus.SENT,
      sentAt,
    });
  }

  private buildScopeWhere(
    scope: ReminderListScope,
  ): Prisma.ReminderWhereInput {
    if (!scope.counselUserId) {
      return {};
    }

    const userId = scope.counselUserId;

    return {
      OR: [
        { deadline: { assigneeId: userId } },
        {
          deadline: {
            legalCase: { ownerId: userId, deletedAt: null },
          },
        },
        {
          deadline: {
            contract: { ownerId: userId, deletedAt: null },
          },
        },
        {
          deadline: {
            notice: { ownerId: userId, deletedAt: null },
          },
        },
      ],
    };
  }

  private buildViewWhere(
    filters: ListRemindersFilters,
  ): Prisma.ReminderWhereInput {
    if (filters.status) {
      return { status: filters.status };
    }

    switch (filters.view) {
      case ReminderView.UPCOMING:
        return {
          status: ReminderStatus.PENDING,
          remindAt: { gt: filters.now },
        };
      case ReminderView.DUE:
        return {
          status: ReminderStatus.PENDING,
          remindAt: { lte: filters.now },
        };
      case ReminderView.SENT:
        return {
          status: ReminderStatus.SENT,
        };
      case ReminderView.ASSIGNED_TO_ME:
        return {
          deadline: { assigneeId: filters.currentUserId },
        };
      default:
        return {};
    }
  }

  private buildOrderBy(
    view?: ReminderView,
    status?: ReminderStatus,
  ): Prisma.ReminderOrderByWithRelationInput {
    if (status === ReminderStatus.SENT || view === ReminderView.SENT) {
      return { sentAt: 'desc' };
    }

    if (
      view === ReminderView.UPCOMING ||
      view === ReminderView.DUE ||
      view === ReminderView.ASSIGNED_TO_ME ||
      status === ReminderStatus.PENDING
    ) {
      return { remindAt: 'asc' };
    }

    if (status === ReminderStatus.DISMISSED) {
      return { updatedAt: 'desc' };
    }

    return { createdAt: 'desc' };
  }
}
