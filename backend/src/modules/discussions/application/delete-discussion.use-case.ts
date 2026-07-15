import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDiscussionRepository } from '../infrastructure/prisma-discussion.repository';
import { resolveParentOwnerId } from './discussion.helpers';

@Injectable()
export class DeleteDiscussionUseCase {
  constructor(
    private readonly discussionRepository: PrismaDiscussionRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, discussionId: string) {
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

    await this.discussionRepository.softDelete(discussionId);

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.DELETED,
      entityType: EntityType.DISCUSSION,
      entityId: discussionId,
      metadata: {
        authorId: existing.authorId,
        caseId: existing.caseId,
        contractId: existing.contractId,
        noticeId: existing.noticeId,
      },
    });

    return buildSingleResponse({ success: true });
  }
}
