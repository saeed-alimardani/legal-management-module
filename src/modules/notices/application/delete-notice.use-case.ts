import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaNoticeRepository } from '../infrastructure/prisma-notice.repository';

@Injectable()
export class DeleteNoticeUseCase {
  constructor(
    private readonly noticeRepository: PrismaNoticeRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, noticeId: string) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.noticeRepository.findById(noticeId);

    if (!existing) {
      throw new NotFoundException('Notice not found');
    }

    await this.noticeRepository.softDelete(noticeId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.NOTICE,
      entityId: noticeId,
      metadata: {
        referenceCode: existing.referenceCode,
        title: existing.title,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
