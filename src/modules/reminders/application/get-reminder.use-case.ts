import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaReminderRepository } from '../infrastructure/prisma-reminder.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toReminderResponse,
} from './reminder.helpers';

@Injectable()
export class GetReminderUseCase {
  constructor(
    private readonly reminderRepository: PrismaReminderRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, reminderId: string) {
    const reminder = await this.reminderRepository.findById(reminderId);

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    const parentOwnerId = resolveParentOwnerId(reminder);

    if (!parentOwnerId) {
      throw new NotFoundException('Reminder not found');
    }

    this.accessControl.assertCanView(user, {
      ownerId: parentOwnerId,
      assigneeId: reminder.deadline.assigneeId,
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toReminderResponse(reminder, timeZone));
  }
}
