import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReminderStatus } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ReminderView } from '../domain/reminder-view.enum';
import { PrismaReminderRepository } from '../infrastructure/prisma-reminder.repository';
import {
  resolveResponseTimeZone,
  toReminderResponse,
} from './reminder.helpers';

export interface ListRemindersCommand {
  view?: ReminderView;
  status?: ReminderStatus;
  page: number;
  limit: number;
}

@Injectable()
export class ListRemindersUseCase {
  constructor(
    private readonly reminderRepository: PrismaReminderRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListRemindersCommand) {
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );
    const now = new Date();
    const scope = this.accessControl.buildDeadlineListFilter(user);

    const { items, total } = await this.reminderRepository.list(
      {
        view: command.view,
        status: command.status,
        now,
        currentUserId: user.id,
        page: command.page,
        limit: command.limit,
      },
      scope,
    );

    return buildPaginatedResponse(
      items.map((item) => toReminderResponse(item, timeZone)),
      {
        page: command.page,
        limit: command.limit,
        total,
      },
    );
  }
}
