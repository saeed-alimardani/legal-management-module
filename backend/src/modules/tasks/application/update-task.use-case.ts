import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, TaskStatus } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { UpdateTaskInput } from '../domain/task.types';
import { PrismaTaskRepository } from '../infrastructure/prisma-task.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toTaskResponse,
} from './task.helpers';

export interface UpdateTaskCommand {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string;
  dueDate?: Date | null;
}

@Injectable()
export class UpdateTaskUseCase {
  constructor(
    private readonly taskRepository: PrismaTaskRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    taskId: string,
    command: UpdateTaskCommand,
  ) {
    const existing = await this.taskRepository.findById(taskId);

    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Task not found');
    }

    this.accessControl.assertCanEditTask(user, {
      ownerId: parentOwnerId,
      assigneeId: existing.assigneeId,
      createdById: existing.createdById,
    });

    if (command.assigneeId) {
      const assigneeExists = await this.taskRepository.userExistsAndActive(
        command.assigneeId,
      );

      if (!assigneeExists) {
        throw new NotFoundException('Assignee user not found or inactive');
      }
    }

    const updateInput = this.buildUpdateInput(existing.status, command);
    const updated = await this.taskRepository.update(taskId, updateInput);

    const changedFields = this.getChangedFields(existing, command);
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    if (changedFields.length === 0) {
      return buildSingleResponse(toTaskResponse(updated, timeZone));
    }

    await this.activityLogService.log({
      actorId: user.id,
      action:
        command.status !== undefined && command.status !== existing.status
          ? AuditAction.STATUS_CHANGED
          : AuditAction.UPDATED,
      entityType: EntityType.TASK,
      entityId: updated.id,
      metadata:
        command.status !== undefined && command.status !== existing.status
          ? {
              from: existing.status,
              to: updated.status,
              fields: changedFields,
            }
          : { fields: changedFields },
    });

    return buildSingleResponse(toTaskResponse(updated, timeZone));
  }

  private buildUpdateInput(
    currentStatus: TaskStatus,
    command: UpdateTaskCommand,
  ): UpdateTaskInput {
    const input: UpdateTaskInput = {
      ...(command.title !== undefined ? { title: command.title } : {}),
      ...(command.description !== undefined
        ? { description: command.description }
        : {}),
      ...(command.status !== undefined ? { status: command.status } : {}),
      ...(command.assigneeId !== undefined
        ? { assigneeId: command.assigneeId }
        : {}),
      ...(command.dueDate !== undefined
        ? {
            dueDate:
              command.dueDate === null ? null : toUtcDateOnly(command.dueDate),
          }
        : {}),
    };

    if (command.status === TaskStatus.DONE) {
      input.completedAt = new Date();
    } else if (
      command.status !== undefined &&
      currentStatus === TaskStatus.DONE
    ) {
      input.completedAt = null;
    }

    return input;
  }

  private getChangedFields(
    existing: {
      title: string;
      description: string | null;
      status: TaskStatus;
      assigneeId: string;
      dueDate: Date | null;
    },
    command: UpdateTaskCommand,
  ): string[] {
    const changed: string[] = [];

    if (command.title !== undefined && command.title !== existing.title) {
      changed.push('title');
    }

    if (
      command.description !== undefined &&
      command.description !== existing.description
    ) {
      changed.push('description');
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

    if (command.dueDate !== undefined) {
      const next =
        command.dueDate === null
          ? null
          : toUtcDateOnly(command.dueDate).toISOString();
      const current = existing.dueDate
        ? toUtcDateOnly(existing.dueDate).toISOString()
        : null;

      if (next !== current) {
        changed.push('dueDate');
      }
    }

    return changed;
  }
}
