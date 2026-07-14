import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';

export interface ListActivityLogsCommand {
  entityType?: EntityType;
  entityId?: string;
  actorId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListActivityLogsUseCase {
  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly accessControl: AccessControlService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListActivityLogsCommand) {
    const entityScoped =
      command.entityType !== undefined && command.entityId !== undefined;

    if (entityScoped) {
      await this.assertCanViewEntity(
        user,
        command.entityType!,
        command.entityId!,
      );
    }

    const { items, total, page, limit } = await this.activityLogService.list(
      {
        entityType: command.entityType,
        entityId: command.entityId,
        actorId: command.actorId,
        page: command.page,
        limit: command.limit,
      },
      user,
      { skipCounselActorScope: entityScoped },
    );

    return buildPaginatedResponse(items, { page, limit, total });
  }

  private async assertCanViewEntity(
    user: AuthenticatedUser,
    entityType: EntityType,
    entityId: string,
  ): Promise<void> {
    if (
      this.accessControl.isAdminOrManager(user) ||
      this.accessControl.isViewer(user)
    ) {
      return;
    }

    switch (entityType) {
      case EntityType.CASE: {
        const legalCase = await this.prisma.legalCase.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { ownerId: true },
        });
        if (!legalCase) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, {
          ownerId: legalCase.ownerId,
        });
        return;
      }
      case EntityType.CONTRACT: {
        const contract = await this.prisma.contract.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { ownerId: true },
        });
        if (!contract) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, {
          ownerId: contract.ownerId,
        });
        return;
      }
      case EntityType.NOTICE: {
        const notice = await this.prisma.legalNotice.findFirst({
          where: { id: entityId, deletedAt: null },
          select: { ownerId: true },
        });
        if (!notice) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, { ownerId: notice.ownerId });
        return;
      }
      case EntityType.DEADLINE: {
        const deadline = await this.prisma.deadline.findUnique({
          where: { id: entityId },
          include: {
            legalCase: { select: { ownerId: true, deletedAt: true } },
            contract: { select: { ownerId: true, deletedAt: true } },
            notice: { select: { ownerId: true, deletedAt: true } },
          },
        });
        if (!deadline) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(deadline);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, {
          ownerId,
          assigneeId: deadline.assigneeId,
        });
        return;
      }
      case EntityType.TASK: {
        const task = await this.prisma.task.findUnique({
          where: { id: entityId },
          include: {
            legalCase: { select: { ownerId: true, deletedAt: true } },
            contract: { select: { ownerId: true, deletedAt: true } },
            notice: { select: { ownerId: true, deletedAt: true } },
          },
        });
        if (!task) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(task);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, {
          ownerId,
          assigneeId: task.assigneeId,
        });
        return;
      }
      case EntityType.DOCUMENT: {
        const document = await this.prisma.document.findFirst({
          where: { id: entityId, deletedAt: null },
          include: {
            legalCase: { select: { ownerId: true, deletedAt: true } },
            contract: { select: { ownerId: true, deletedAt: true } },
            notice: { select: { ownerId: true, deletedAt: true } },
          },
        });
        if (!document) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(document);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, { ownerId });
        return;
      }
      case EntityType.DISCUSSION: {
        const discussion = await this.prisma.discussion.findFirst({
          where: { id: entityId, deletedAt: null },
          include: {
            legalCase: { select: { ownerId: true, deletedAt: true } },
            contract: { select: { ownerId: true, deletedAt: true } },
            notice: { select: { ownerId: true, deletedAt: true } },
          },
        });
        if (!discussion) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(discussion);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, { ownerId });
        return;
      }
      case EntityType.FINANCIAL_RECORD: {
        const financialRecord = await this.prisma.financialRecord.findFirst({
          where: { id: entityId, deletedAt: null },
          include: {
            legalCase: { select: { ownerId: true, deletedAt: true } },
            contract: { select: { ownerId: true, deletedAt: true } },
          },
        });
        if (!financialRecord) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId =
          this.resolveFinancialRecordParentOwnerId(financialRecord);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, { ownerId });
        return;
      }
      case EntityType.REMINDER: {
        const reminder = await this.prisma.reminder.findUnique({
          where: { id: entityId },
          include: {
            deadline: {
              include: {
                legalCase: { select: { ownerId: true, deletedAt: true } },
                contract: { select: { ownerId: true, deletedAt: true } },
                notice: { select: { ownerId: true, deletedAt: true } },
              },
            },
          },
        });
        if (!reminder) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(reminder.deadline);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        this.accessControl.assertCanView(user, {
          ownerId,
          assigneeId: reminder.deadline.assigneeId,
        });
        return;
      }
      default:
        throw new ForbiddenException(
          'You do not have access to this activity log',
        );
    }
  }

  private resolveParentOwnerId(entity: {
    legalCase?: { ownerId: string; deletedAt: Date | null } | null;
    contract?: { ownerId: string; deletedAt: Date | null } | null;
    notice?: { ownerId: string; deletedAt: Date | null } | null;
  }): string | null {
    if (entity.legalCase && entity.legalCase.deletedAt === null) {
      return entity.legalCase.ownerId;
    }
    if (entity.contract && entity.contract.deletedAt === null) {
      return entity.contract.ownerId;
    }
    if (entity.notice && entity.notice.deletedAt === null) {
      return entity.notice.ownerId;
    }
    return null;
  }

  private resolveFinancialRecordParentOwnerId(entity: {
    legalCase?: { ownerId: string; deletedAt: Date | null } | null;
    contract?: { ownerId: string; deletedAt: Date | null } | null;
  }): string | null {
    if (entity.legalCase && entity.legalCase.deletedAt === null) {
      return entity.legalCase.ownerId;
    }
    if (entity.contract && entity.contract.deletedAt === null) {
      return entity.contract.ownerId;
    }
    return null;
  }
}
