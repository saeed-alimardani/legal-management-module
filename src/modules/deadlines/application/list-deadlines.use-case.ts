import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { todayInTimezone } from '../../../shared/utils/date-boundary.util';
import { DeadlineView } from '../domain/deadline-view.enum';
import { PrismaDeadlineRepository } from '../infrastructure/prisma-deadline.repository';
import {
  resolveResponseTimeZone,
  toDeadlineResponse,
} from './deadline.helpers';

export interface ListDeadlinesCommand {
  view?: DeadlineView;
  page: number;
  limit: number;
}

@Injectable()
export class ListDeadlinesUseCase {
  constructor(
    private readonly deadlineRepository: PrismaDeadlineRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListDeadlinesCommand) {
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );
    const today = todayInTimezone(timeZone);
    const scope = this.accessControl.buildDeadlineListFilter(user);

    const { items, total } = await this.deadlineRepository.list(
      {
        view: command.view,
        today,
        currentUserId: user.id,
        page: command.page,
        limit: command.limit,
      },
      scope,
    );

    return buildPaginatedResponse(
      items.map((item) => toDeadlineResponse(item, timeZone)),
      {
        page: command.page,
        limit: command.limit,
        total,
      },
    );
  }
}
