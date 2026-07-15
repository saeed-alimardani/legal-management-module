import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class DeletePartyUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, caseId: string, partyId: string) {
    const legalCase = await this.caseRepository.findById(caseId);

    if (!legalCase) {
      throw new NotFoundException('Case not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: legalCase.ownerId });

    const existing = await this.caseRepository.findPartyById(caseId, partyId);

    if (!existing) {
      throw new NotFoundException('Party not found');
    }

    await this.caseRepository.deleteParty(caseId, partyId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: caseId,
      metadata: {
        partyRemoved: {
          id: existing.id,
          name: existing.name,
        },
      },
    });

    return buildSingleResponse({ id: partyId, deleted: true });
  }
}
