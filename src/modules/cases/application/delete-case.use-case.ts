import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class DeleteCaseUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, caseId: string) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.caseRepository.findById(caseId);

    if (!existing) {
      throw new NotFoundException('Case not found');
    }

    await this.caseRepository.softDelete(caseId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.CASE,
      entityId: caseId,
      metadata: {
        referenceCode: existing.referenceCode,
        title: existing.title,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
