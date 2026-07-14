import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, DeadlineStatus, EntityType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { UpdateDeadlineInput } from '../domain/deadline.types';
import { PrismaDeadlineRepository } from '../infrastructure/prisma-deadline.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toDeadlineResponse,
} from './deadline.helpers';

export interface UpdateDeadlineCommand {
  title?: string;
  dueDate?: Date;
  status?: DeadlineStatus;
  assigneeId?: string | null;
}

@Injectable()
export class UpdateDeadlineUseCase {
  constructor(
    private readonly deadlineRepository: PrismaDeadlineRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    deadlineId: string,
    command: UpdateDeadlineCommand,
  ) {
    const existing = await this.deadlineRepository.findById(deadlineId);

    if (!existing) {
      throw new NotFoundException('Deadline not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Deadline not found');
    }

    this.accessControl.assertCanEditDeadline(user, {
      ownerId: parentOwnerId,
      assigneeId: existing.assigneeId,
    });

    if (command.assigneeId) {
      const assigneeExists =
        await this.deadlineRepository.userExistsAndActive(command.assigneeId);

      if (!assigneeExists) {
        throw new NotFoundException('Assignee user not found or inactive');
      }
    }

    const updateInput = this.buildUpdateInput(existing.status, command);
    const updated = await this.deadlineRepository.update(
      deadlineId,
      updateInput,
    );

    const becameCompleted =
      command.status === DeadlineStatus.COMPLETED &&
      existing.status !== DeadlineStatus.COMPLETED;

    const changedFields = this.getChangedFields(existing, command);
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    if (changedFields.length === 0) {
      return buildSingleResponse(toDeadlineResponse(updated, timeZone));
    }

    await this.activityLogService.log({
      actorId: user.id,
      action: becameCompleted
        ? AuditAction.DEADLINE_COMPLETED
        : command.status !== undefined && command.status !== existing.status
          ? AuditAction.STATUS_CHANGED
          : AuditAction.UPDATED,
      entityType: EntityType.DEADLINE,
      entityId: updated.id,
      metadata: becameCompleted
        ? { from: existing.status, to: updated.status, fields: changedFields }
        : command.status !== undefined && command.status !== existing.status
          ? {
              from: existing.status,
              to: updated.status,
              fields: changedFields,
            }
          : { fields: changedFields },
    });

    return buildSingleResponse(toDeadlineResponse(updated, timeZone));
  }

  private buildUpdateInput(
    currentStatus: DeadlineStatus,
    command: UpdateDeadlineCommand,
  ): UpdateDeadlineInput {
    const input: UpdateDeadlineInput = {
      ...(command.title !== undefined ? { title: command.title } : {}),
      ...(command.dueDate !== undefined
        ? { dueDate: toUtcDateOnly(command.dueDate) }
        : {}),
      ...(command.status !== undefined ? { status: command.status } : {}),
      ...(command.assigneeId !== undefined
        ? { assigneeId: command.assigneeId }
        : {}),
    };

    if (command.status === DeadlineStatus.COMPLETED) {
      input.completedAt = new Date();
    } else if (
      command.status !== undefined &&
      currentStatus === DeadlineStatus.COMPLETED
    ) {
      input.completedAt = null;
    }

    return input;
  }

  private getChangedFields(
    existing: {
      title: string;
      dueDate: Date;
      status: DeadlineStatus;
      assigneeId: string | null;
    },
    command: UpdateDeadlineCommand,
  ): string[] {
    const changed: string[] = [];

    if (command.title !== undefined && command.title !== existing.title) {
      changed.push('title');
    }

    if (
      command.dueDate !== undefined &&
      toUtcDateOnly(command.dueDate).toISOString() !==
        toUtcDateOnly(existing.dueDate).toISOString()
    ) {
      changed.push('dueDate');
    }

    if (command.status !== undefined && command.status !== existing.status) {
      changed.push('status');
    }

    if (
      command.assigneeId !== undefined &&
      command.assigneeId !== existing.assigneeId
    ) {
      changed.push('assigneeId');
    }

    return changed;
  }
}
