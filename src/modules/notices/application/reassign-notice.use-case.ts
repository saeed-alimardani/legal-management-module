import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaNoticeRepository } from '../infrastructure/prisma-notice.repository';
import {
  resolveNoticeResponseTimeZone,
  toNoticeResponse,
} from './notice.helpers';

@Injectable()
export class ReassignNoticeUseCase {
  constructor(
    private readonly noticeRepository: PrismaNoticeRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, noticeId: string, newOwnerId: string) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.noticeRepository.findById(noticeId);

    if (!existing) {
      throw new NotFoundException('Notice not found');
    }

    if (existing.ownerId === newOwnerId) {
      return this.toResponse(existing);
    }

    const ownerExists =
      await this.noticeRepository.userExistsAndActive(newOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('New owner user not found or inactive');
    }

    const updated = await this.noticeRepository.reassign(noticeId, newOwnerId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.NOTICE,
      entityId: updated.id,
      metadata: {
        fromUserId: existing.ownerId,
        toUserId: newOwnerId,
      },
    });

    return this.toResponse(updated);
  }

  private toResponse(notice: Parameters<typeof toNoticeResponse>[0]) {
    const timeZone = resolveNoticeResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toNoticeResponse(notice, timeZone));
  }
}
