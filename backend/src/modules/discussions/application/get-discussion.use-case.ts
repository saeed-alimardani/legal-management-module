import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDiscussionRepository } from '../infrastructure/prisma-discussion.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toDiscussionResponse,
} from './discussion.helpers';

@Injectable()
export class GetDiscussionUseCase {
  constructor(
    private readonly discussionRepository: PrismaDiscussionRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, discussionId: string) {
    const discussion = await this.discussionRepository.findById(discussionId);

    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }

    const parentOwnerId = resolveParentOwnerId(discussion);

    if (!parentOwnerId) {
      throw new NotFoundException('Discussion not found');
    }

    this.accessControl.assertCanView(user, { ownerId: parentOwnerId });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toDiscussionResponse(discussion, timeZone));
  }
}
