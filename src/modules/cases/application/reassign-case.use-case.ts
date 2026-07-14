import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class ReassignCaseUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    caseId: string,
    newOwnerId: string,
  ) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.caseRepository.findById(caseId);

    if (!existing) {
      throw new NotFoundException('Case not found');
    }

    if (existing.ownerId === newOwnerId) {
      return buildSingleResponse(existing);
    }

    const ownerExists = await this.caseRepository.userExistsAndActive(newOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('New owner user not found or inactive');
    }

    const updated = await this.caseRepository.reassign(caseId, newOwnerId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.CASE,
      entityId: updated.id,
      metadata: {
        fromUserId: existing.ownerId,
        toUserId: newOwnerId,
      },
    });

    return buildSingleResponse(updated);
  }
}
