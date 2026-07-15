import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';

export interface OwnershipTransferCounts {
  cases: number;
  contracts: number;
  notices: number;
  tasks: number;
  deadlines: number;
}

@Injectable()
export class BulkTransferOwnershipUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, fromUserId: string, toUserId: string) {
    this.accessControl.assertCanReassign(user);

    if (fromUserId === toUserId) {
      throw new BadRequestException(
        'fromUserId and toUserId must be different users',
      );
    }

    await this.assertActiveUser(fromUserId, 'fromUserId');
    await this.assertActiveUser(toUserId, 'toUserId');

    const counts = await this.prisma.$transaction(async (tx) => {
      const [cases, contracts, notices, tasks, deadlines] = await Promise.all([
        tx.legalCase.updateMany({
          where: { ownerId: fromUserId, deletedAt: null },
          data: { ownerId: toUserId },
        }),
        tx.contract.updateMany({
          where: { ownerId: fromUserId, deletedAt: null },
          data: { ownerId: toUserId },
        }),
        tx.legalNotice.updateMany({
          where: { ownerId: fromUserId, deletedAt: null },
          data: { ownerId: toUserId },
        }),
        tx.task.updateMany({
          where: { assigneeId: fromUserId, deletedAt: null },
          data: { assigneeId: toUserId },
        }),
        tx.deadline.updateMany({
          where: { assigneeId: fromUserId },
          data: { assigneeId: toUserId },
        }),
      ]);

      const transferCounts: OwnershipTransferCounts = {
        cases: cases.count,
        contracts: contracts.count,
        notices: notices.count,
        tasks: tasks.count,
        deadlines: deadlines.count,
      };

      await this.activityLogService.logWithinTransaction(tx, {
        actorId: user.id,
        action: AuditAction.OWNERSHIP_TRANSFERRED,
        entityType: EntityType.USER,
        entityId: toUserId,
        metadata: {
          fromUserId,
          toUserId,
          counts: transferCounts,
        },
      });

      return transferCounts;
    });

    return buildSingleResponse(counts);
  }

  private async assertActiveUser(
    userId: string,
    fieldName: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`${fieldName} user not found or inactive`);
    }
  }
}
