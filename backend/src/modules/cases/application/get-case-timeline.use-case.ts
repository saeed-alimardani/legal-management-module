import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class GetCaseTimelineUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    caseId: string,
    page = 1,
    limit = 20,
  ) {
    const legalCase = await this.caseRepository.findById(caseId);

    if (!legalCase) {
      throw new NotFoundException('Case not found');
    }

    const involved = await this.caseRepository.isUserInvolved(caseId, user.id);
    this.accessControl.assertCanViewMatter(user, legalCase.ownerId, involved);

    const { items, total } = await this.activityLogService.list(
      {
        entityType: EntityType.CASE,
        entityId: caseId,
        page,
        limit,
      },
      user,
      { skipCounselActorScope: true },
    );

    return buildPaginatedResponse(items, { page, limit, total });
  }
}
