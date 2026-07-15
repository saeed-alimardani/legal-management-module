import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaFinancialRecordRepository } from '../infrastructure/prisma-financial-record.repository';
import { resolveParentOwnerId } from './financial-record.helpers';

@Injectable()
export class DeleteFinancialRecordUseCase {
  constructor(
    private readonly financialRecordRepository: PrismaFinancialRecordRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, recordId: string) {
    this.accessControl.assertCanMutate(user);

    const existing = await this.financialRecordRepository.findById(recordId);

    if (!existing) {
      throw new NotFoundException('Financial record not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Financial record not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: parentOwnerId });

    await this.financialRecordRepository.softDelete(recordId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.FINANCIAL_RECORD,
      entityId: recordId,
      metadata: {
        title: existing.title,
        amount: existing.amount.toFixed(2),
        currency: existing.currency,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
