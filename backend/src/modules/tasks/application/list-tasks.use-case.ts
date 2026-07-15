import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskStatus } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaTaskRepository } from '../infrastructure/prisma-task.repository';
import { resolveResponseTimeZone, toTaskResponse } from './task.helpers';

export interface ListTasksCommand {
  assigneeId?: string;
  status?: TaskStatus;
  caseId?: string;
  contractId?: string;
  noticeId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListTasksUseCase {
  constructor(
    private readonly taskRepository: PrismaTaskRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListTasksCommand) {
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );
    const scope = this.accessControl.buildTaskListFilter(user);

    const { items, total } = await this.taskRepository.list(
      {
        assigneeId: command.assigneeId,
        status: command.status,
        caseId: command.caseId,
        contractId: command.contractId,
        noticeId: command.noticeId,
        page: command.page,
        limit: command.limit,
      },
      scope,
    );

    return buildPaginatedResponse(
      items.map((item) => toTaskResponse(item, timeZone)),
      {
        page: command.page,
        limit: command.limit,
        total,
      },
    );
  }
}
