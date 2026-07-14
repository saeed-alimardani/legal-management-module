import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { ActivityLogInput } from './domain/audit.types';

export interface ActivityLogListFilters {
  entityType?: ActivityLogInput['entityType'];
  entityId?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ActivityLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async log(input: ActivityLogInput): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async logWithinTransaction(
    tx: Prisma.TransactionClient,
    input: ActivityLogInput,
  ): Promise<void> {
    await tx.activityLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(filters: ActivityLogListFilters, user: AuthenticatedUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...this.buildListScope(user),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          actor: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private buildListScope(
    user: AuthenticatedUser,
  ): Prisma.ActivityLogWhereInput {
    if (this.accessControl.isAdminOrManager(user) || this.accessControl.isViewer(user)) {
      return {};
    }

    if (user.role === UserRole.LEGAL_COUNSEL) {
      return { actorId: user.id };
    }

    return {};
  }
}
