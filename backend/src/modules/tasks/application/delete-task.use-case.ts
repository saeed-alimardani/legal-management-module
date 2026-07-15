import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaTaskRepository } from '../infrastructure/prisma-task.repository';
import { resolveParentOwnerId } from './task.helpers';

@Injectable()
export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepository: PrismaTaskRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, taskId: string) {
    this.accessControl.assertCanManageCoreEntities(user);

    const existing = await this.taskRepository.findById(taskId);

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Task not found');
    }

    this.accessControl.assertCanCancelTask(user, {
      createdById: existing.createdById,
    });

    await this.taskRepository.softDelete(taskId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.TASK,
      entityId: taskId,
      metadata: {
        title: existing.title,
        previousStatus: existing.status,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
