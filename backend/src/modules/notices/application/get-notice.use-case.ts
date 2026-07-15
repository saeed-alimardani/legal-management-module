import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaNoticeRepository } from '../infrastructure/prisma-notice.repository';
import {
  resolveNoticeResponseTimeZone,
  toNoticeResponse,
} from './notice.helpers';

@Injectable()
export class GetNoticeUseCase {
  constructor(
    private readonly noticeRepository: PrismaNoticeRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, noticeId: string) {
    const notice = await this.noticeRepository.findById(noticeId);

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const involved = await this.noticeRepository.isUserInvolved(noticeId, user.id);
    this.accessControl.assertCanViewMatter(user, notice.ownerId, involved);

    const timeZone = resolveNoticeResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toNoticeResponse(notice, timeZone));
  }
}
