import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaReminderRepository } from '../infrastructure/prisma-reminder.repository';
import {
  resolveResponseTimeZone,
  toReminderResponse,
} from './reminder.helpers';

@Injectable()
export class ProcessDueRemindersUseCase {
  constructor(
    private readonly reminderRepository: PrismaReminderRepository,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser) {
    const now = new Date();
    const dueReminders = await this.reminderRepository.findDuePending(now);
    const processed: ReturnType<typeof toReminderResponse>[] = [];

    for (const reminder of dueReminders) {
      const updated = await this.reminderRepository.markSent(reminder.id, now);

      await this.activityLogService.log({
        actorId: user.id,
        action: AuditAction.REMINDER_SENT,
        entityType: EntityType.REMINDER,
        entityId: updated.id,
        metadata: {
          deadlineId: updated.deadlineId,
          remindAt: updated.remindAt.toISOString(),
          sentAt: now.toISOString(),
        },
      });

      processed.push(
        toReminderResponse(
          updated,
          resolveResponseTimeZone(
            this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
          ),
        ),
      );
    }

    return buildSingleResponse({
      processedCount: processed.length,
      reminders: processed,
    });
  }
}
