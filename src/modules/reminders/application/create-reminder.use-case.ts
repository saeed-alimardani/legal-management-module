import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, ReminderStatus } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { PrismaDeadlineRepository } from '../../deadlines/infrastructure/prisma-deadline.repository';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { resolveParentOwnerId as resolveDeadlineParentOwnerId } from '../../deadlines/application/deadline.helpers';
import { PrismaReminderRepository } from '../infrastructure/prisma-reminder.repository';
import {
  resolveResponseTimeZone,
  toReminderResponse,
} from './reminder.helpers';

export interface CreateReminderCommand {
  deadlineId: string;
  remindAt: Date;
  message?: string | null;
}

@Injectable()
export class CreateReminderUseCase {
  constructor(
    private readonly reminderRepository: PrismaReminderRepository,
    private readonly deadlineRepository: PrismaDeadlineRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateReminderCommand) {
    this.accessControl.assertCanMutate(user);

    const deadline = await this.deadlineRepository.findById(command.deadlineId);

    if (!deadline) {
      throw new NotFoundException('Deadline not found');
    }

    const parentOwnerId = resolveDeadlineParentOwnerId(deadline);

    if (!parentOwnerId) {
      throw new NotFoundException('Deadline not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: parentOwnerId });

    const reminder = await this.reminderRepository.create({
      deadlineId: command.deadlineId,
      remindAt: command.remindAt,
      status: ReminderStatus.PENDING,
      message: command.message ?? null,
      createdById: user.id,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.REMINDER,
      entityId: reminder.id,
      metadata: {
        deadlineId: reminder.deadlineId,
        remindAt: reminder.remindAt.toISOString(),
        message: reminder.message,
      },
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toReminderResponse(reminder, timeZone));
  }
}
