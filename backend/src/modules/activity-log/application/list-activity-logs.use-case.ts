import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import {
  buildCounselCaseWhere,
  buildCounselContractWhere,
  buildCounselDiscussionWhere,
  buildCounselDocumentWhere,
  buildCounselFinancialRecordWhere,
  buildCounselNoticeWhere,
} from '../../../shared/access-control/counsel-involvement.where';
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
    this.accessControl.assertCanViewActivityLogs(user);

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
    if (this.accessControl.isAdminOrManager(user)) {
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
        const involved = await this.isUserInvolvedInCase(entityId, user.id);
        this.accessControl.assertCanViewMatter(
          user,
          legalCase.ownerId,
          involved,
        );
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
        const involved = await this.isUserInvolvedInContract(entityId, user.id);
        this.accessControl.assertCanViewMatter(user, contract.ownerId, involved);
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
        const involved = await this.isUserInvolvedInNotice(entityId, user.id);
        this.accessControl.assertCanViewMatter(user, notice.ownerId, involved);
        return;
      }
      case EntityType.DEADLINE: {
        const deadline = await this.prisma.deadline.findUnique({
          where: { id: entityId },
          include: {
            legalCase: { select: { id: true, ownerId: true, deletedAt: true } },
            contract: { select: { id: true, ownerId: true, deletedAt: true } },
            notice: { select: { id: true, ownerId: true, deletedAt: true } },
          },
        });
        if (!deadline) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(deadline);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        const involved =
          deadline.assigneeId === user.id ||
          (await this.isUserInvolvedInParentMatter(deadline, user.id));
        this.accessControl.assertCanViewMatter(user, ownerId, involved);
        return;
      }
      case EntityType.TASK: {
        const task = await this.prisma.task.findUnique({
          where: { id: entityId },
          include: {
            legalCase: { select: { id: true, ownerId: true, deletedAt: true } },
            contract: { select: { id: true, ownerId: true, deletedAt: true } },
            notice: { select: { id: true, ownerId: true, deletedAt: true } },
          },
        });
        if (!task) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(task);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        const involved =
          task.assigneeId === user.id ||
          task.createdById === user.id ||
          (await this.isUserInvolvedInParentMatter(task, user.id));
        this.accessControl.assertCanViewMatter(user, ownerId, involved);
        return;
      }
      case EntityType.DOCUMENT: {
        const document = await this.prisma.document.findFirst({
          where: { id: entityId, deletedAt: null },
          include: {
            legalCase: { select: { id: true, ownerId: true, deletedAt: true } },
            contract: { select: { id: true, ownerId: true, deletedAt: true } },
            notice: { select: { id: true, ownerId: true, deletedAt: true } },
          },
        });
        if (!document) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(document);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        const involved = await this.isUserInvolvedInDocument(entityId, user.id);
        this.accessControl.assertCanViewMatter(user, ownerId, involved);
        return;
      }
      case EntityType.DISCUSSION: {
        const discussion = await this.prisma.discussion.findFirst({
          where: { id: entityId, deletedAt: null },
          include: {
            legalCase: { select: { id: true, ownerId: true, deletedAt: true } },
            contract: { select: { id: true, ownerId: true, deletedAt: true } },
            notice: { select: { id: true, ownerId: true, deletedAt: true } },
          },
        });
        if (!discussion) {
          throw new NotFoundException('Entity not found');
        }
        const ownerId = this.resolveParentOwnerId(discussion);
        if (!ownerId) {
          throw new NotFoundException('Entity not found');
        }
        const involved = await this.isUserInvolvedInDiscussion(
          entityId,
          user.id,
        );
        this.accessControl.assertCanViewMatter(user, ownerId, involved);
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
        const involved = await this.isUserInvolvedInFinancialRecord(
          entityId,
          user.id,
        );
        this.accessControl.assertCanViewMatter(user, ownerId, involved);
        return;
      }
      case EntityType.REMINDER: {
        const reminder = await this.prisma.reminder.findUnique({
          where: { id: entityId },
          include: {
            deadline: {
              include: {
                legalCase: {
                  select: { id: true, ownerId: true, deletedAt: true },
                },
                contract: {
                  select: { id: true, ownerId: true, deletedAt: true },
                },
                notice: {
                  select: { id: true, ownerId: true, deletedAt: true },
                },
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
        const involved =
          reminder.deadline.assigneeId === user.id ||
          (await this.isUserInvolvedInParentMatter(
            reminder.deadline,
            user.id,
          ));
        this.accessControl.assertCanViewMatter(user, ownerId, involved);
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

  private async isUserInvolvedInCase(
    caseId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.legalCase.count({
      where: { id: caseId, deletedAt: null, ...buildCounselCaseWhere(userId) },
    });
    return count > 0;
  }

  private async isUserInvolvedInContract(
    contractId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.contract.count({
      where: {
        id: contractId,
        deletedAt: null,
        ...buildCounselContractWhere(userId),
      },
    });
    return count > 0;
  }

  private async isUserInvolvedInNotice(
    noticeId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.legalNotice.count({
      where: {
        id: noticeId,
        deletedAt: null,
        ...buildCounselNoticeWhere(userId),
      },
    });
    return count > 0;
  }

  private async isUserInvolvedInDocument(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.document.count({
      where: {
        id: documentId,
        deletedAt: null,
        ...buildCounselDocumentWhere(userId),
      },
    });
    return count > 0;
  }

  private async isUserInvolvedInDiscussion(
    discussionId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.discussion.count({
      where: {
        id: discussionId,
        deletedAt: null,
        ...buildCounselDiscussionWhere(userId),
      },
    });
    return count > 0;
  }

  private async isUserInvolvedInFinancialRecord(
    recordId: string,
    userId: string,
  ): Promise<boolean> {
    const count = await this.prisma.financialRecord.count({
      where: {
        id: recordId,
        deletedAt: null,
        ...buildCounselFinancialRecordWhere(userId),
      },
    });
    return count > 0;
  }

  private async isUserInvolvedInParentMatter(
    entity: {
      legalCase?: { id: string; ownerId: string; deletedAt: Date | null } | null;
      contract?: { id: string; ownerId: string; deletedAt: Date | null } | null;
      notice?: { id: string; ownerId: string; deletedAt: Date | null } | null;
    },
    userId: string,
  ): Promise<boolean> {
    if (entity.legalCase && entity.legalCase.deletedAt === null) {
      return this.isUserInvolvedInCase(entity.legalCase.id, userId);
    }
    if (entity.contract && entity.contract.deletedAt === null) {
      return this.isUserInvolvedInContract(entity.contract.id, userId);
    }
    if (entity.notice && entity.notice.deletedAt === null) {
      return this.isUserInvolvedInNotice(entity.notice.id, userId);
    }
    return false;
  }
}
