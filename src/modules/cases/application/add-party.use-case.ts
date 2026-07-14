import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { CreateCasePartyInput } from '../domain/case.types';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class AddPartyUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    caseId: string,
    command: CreateCasePartyInput,
  ) {
    const legalCase = await this.caseRepository.findById(caseId);

    if (!legalCase) {
      throw new NotFoundException('Case not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: legalCase.ownerId });

    const party = await this.caseRepository.addParty(caseId, command);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: caseId,
      metadata: {
        partyAdded: {
          id: party.id,
          name: party.name,
          partyType: party.partyType,
        },
      },
    });

    return buildSingleResponse(party);
  }
}
