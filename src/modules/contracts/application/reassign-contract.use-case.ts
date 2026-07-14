import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';

@Injectable()
export class ReassignContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    contractId: string,
    newOwnerId: string,
  ) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.contractRepository.findById(contractId);

    if (!existing) {
      throw new NotFoundException('Contract not found');
    }

    if (existing.ownerId === newOwnerId) {
      return buildSingleResponse(existing);
    }

    const ownerExists =
      await this.contractRepository.userExistsAndActive(newOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('New owner user not found or inactive');
    }

    const updated = await this.contractRepository.reassign(
      contractId,
      newOwnerId,
    );

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.CONTRACT,
      entityId: updated.id,
      metadata: {
        fromUserId: existing.ownerId,
        toUserId: newOwnerId,
      },
    });

    return buildSingleResponse(updated);
  }
}
