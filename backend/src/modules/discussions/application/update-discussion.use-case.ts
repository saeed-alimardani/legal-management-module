import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDiscussionRepository } from '../infrastructure/prisma-discussion.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toDiscussionResponse,
} from './discussion.helpers';

export interface UpdateDiscussionCommand {
  content?: string;
}

@Injectable()
export class UpdateDiscussionUseCase {
  constructor(
    private readonly discussionRepository: PrismaDiscussionRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    discussionId: string,
    command: UpdateDiscussionCommand,
  ) {
    this.accessControl.assertCanCreateMatterContent(user);

    const existing = await this.discussionRepository.findById(discussionId);

    if (!existing) {
      throw new NotFoundException('Discussion not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Discussion not found');
    }

    this.accessControl.assertCanEditDiscussion(user, {
      authorId: existing.authorId,
    });

    const updated = await this.discussionRepository.update(discussionId, {
      content: command.content,
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    if (command.content === undefined || command.content === existing.content) {
      return buildSingleResponse(toDiscussionResponse(updated, timeZone));
    }

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.DISCUSSION,
      entityId: updated.id,
      metadata: { fields: ['content'] },
    });

    return buildSingleResponse(toDiscussionResponse(updated, timeZone));
  }
}
