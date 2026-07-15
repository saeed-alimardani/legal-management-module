import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, ReminderStatus } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaReminderRepository } from '../infrastructure/prisma-reminder.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toReminderResponse,
} from './reminder.helpers';

export interface UpdateReminderCommand {
  remindAt?: Date;
  message?: string | null;
  status?: ReminderStatus;
}

@Injectable()
export class UpdateReminderUseCase {
  constructor(
    private readonly reminderRepository: PrismaReminderRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    reminderId: string,
    command: UpdateReminderCommand,
  ) {
    const existing = await this.reminderRepository.findById(reminderId);

    if (!existing) {
      throw new NotFoundException('Reminder not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Reminder not found');
    }

    this.accessControl.assertCanEditDeadline(user, {
      ownerId: parentOwnerId,
      assigneeId: existing.deadline.assigneeId,
    });

    this.assertValidUpdate(existing.status, command);

    const updateInput = {
      ...(command.remindAt !== undefined ? { remindAt: command.remindAt } : {}),
      ...(command.message !== undefined ? { message: command.message } : {}),
      ...(command.status !== undefined ? { status: command.status } : {}),
    };

    const changedFields = this.getChangedFields(existing, command);

    if (changedFields.length === 0) {
      const timeZone = resolveResponseTimeZone(
        this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
      );
      return buildSingleResponse(toReminderResponse(existing, timeZone));
    }

    const updated = await this.reminderRepository.update(
      reminderId,
      updateInput,
    );

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.REMINDER,
      entityId: updated.id,
      metadata: {
        fields: changedFields,
        ...(command.status === ReminderStatus.DISMISSED
          ? { dismissed: true }
          : {}),
      },
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toReminderResponse(updated, timeZone));
  }

  private assertValidUpdate(
    currentStatus: ReminderStatus,
    command: UpdateReminderCommand,
  ): void {
    if (command.status !== undefined && command.status !== ReminderStatus.DISMISSED) {
      throw new BadRequestException('Only status DISMISSED is allowed');
    }

    if (
      currentStatus !== ReminderStatus.PENDING &&
      (command.remindAt !== undefined ||
        command.message !== undefined ||
        command.status === ReminderStatus.DISMISSED)
    ) {
      throw new BadRequestException(
        'Only pending reminders can be updated or dismissed',
      );
    }
  }

  private getChangedFields(
    existing: {
      remindAt: Date;
      message: string | null;
      status: ReminderStatus;
    },
    command: UpdateReminderCommand,
  ): string[] {
    const changed: string[] = [];

    if (
      command.remindAt !== undefined &&
      command.remindAt.getTime() !== existing.remindAt.getTime()
    ) {
      changed.push('remindAt');
    }

    if (
      command.message !== undefined &&
      command.message !== existing.message
    ) {
      changed.push('message');
    }

    if (
      command.status !== undefined &&
      command.status !== existing.status
    ) {
      changed.push('status');
    }

    return changed;
  }
}
