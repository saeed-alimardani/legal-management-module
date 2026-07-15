import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListNoticesFilters } from '../domain/notice.types';
import { PrismaNoticeRepository } from '../infrastructure/prisma-notice.repository';
import {
  resolveNoticeResponseTimeZone,
  toNoticeResponse,
} from './notice.helpers';

@Injectable()
export class ListNoticesUseCase {
  constructor(
    private readonly noticeRepository: PrismaNoticeRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, filters: ListNoticesFilters) {
    const scope = this.accessControl.buildNoticeListScope(user);
    const { items, total } = await this.noticeRepository.list(filters, scope);
    const timeZone = resolveNoticeResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildPaginatedResponse(
      items.map((notice) => toNoticeResponse(notice, timeZone)),
      {
        page: filters.page,
        limit: filters.limit,
        total,
      },
    );
  }
}
