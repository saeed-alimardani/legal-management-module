import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDeadlineRepository } from '../infrastructure/prisma-deadline.repository';
import { resolveParentOwnerId } from './deadline.helpers';

@Injectable()
export class DeleteDeadlineUseCase {
  constructor(
    private readonly deadlineRepository: PrismaDeadlineRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, deadlineId: string) {
    const existing = await this.deadlineRepository.findById(deadlineId);

    if (!existing) {
      throw new NotFoundException('Deadline not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Deadline not found');
    }

    this.accessControl.assertCanCancelDeadline(user, {
      createdById: existing.createdById,
    });

    await this.deadlineRepository.cancel(deadlineId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.DEADLINE,
      entityId: deadlineId,
      metadata: {
        title: existing.title,
        previousStatus: existing.status,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
