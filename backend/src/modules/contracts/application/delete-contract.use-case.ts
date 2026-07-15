import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';

@Injectable()
export class DeleteContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, contractId: string) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.contractRepository.findById(contractId);

    if (!existing) {
      throw new NotFoundException('Contract not found');
    }

    await this.contractRepository.softDelete(contractId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.CONTRACT,
      entityId: contractId,
      metadata: {
        referenceCode: existing.referenceCode,
        title: existing.title,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
