import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDiscussionRepository } from '../infrastructure/prisma-discussion.repository';
import {
  resolveResponseTimeZone,
  toDiscussionResponse,
} from './discussion.helpers';

export interface ListDiscussionsCommand {
  caseId?: string;
  contractId?: string;
  noticeId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListDiscussionsUseCase {
  constructor(
    private readonly discussionRepository: PrismaDiscussionRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListDiscussionsCommand) {
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );
    const scope = this.accessControl.buildDiscussionListFilter(user);

    const { items, total } = await this.discussionRepository.list(
      {
        caseId: command.caseId,
        contractId: command.contractId,
        noticeId: command.noticeId,
        page: command.page,
        limit: command.limit,
      },
      scope,
    );

    return buildPaginatedResponse(
      items.map((item) => toDiscussionResponse(item, timeZone)),
      {
        page: command.page,
        limit: command.limit,
        total,
      },
    );
  }
}
