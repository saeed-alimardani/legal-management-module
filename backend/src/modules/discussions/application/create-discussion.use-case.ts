import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDiscussionRepository } from '../infrastructure/prisma-discussion.repository';
import {
  countParentRefs,
  resolveResponseTimeZone,
  toDiscussionResponse,
} from './discussion.helpers';

export interface CreateDiscussionCommand {
  content: string;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

@Injectable()
export class CreateDiscussionUseCase {
  constructor(
    private readonly discussionRepository: PrismaDiscussionRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateDiscussionCommand) {
    this.accessControl.assertCanMutate(user);

    if (countParentRefs(command) !== 1) {
      throw new BadRequestException(
        'Exactly one of caseId, contractId, or noticeId is required',
      );
    }

    const parent = await this.discussionRepository.findParentOwner({
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
    });

    if (!parent) {
      throw new NotFoundException('Parent matter not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: parent.ownerId });

    const discussion = await this.discussionRepository.create({
      content: command.content,
      authorId: user.id,
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.DISCUSSION,
      entityId: discussion.id,
      metadata: {
        authorId: discussion.authorId,
        caseId: discussion.caseId,
        contractId: discussion.contractId,
        noticeId: discussion.noticeId,
      },
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toDiscussionResponse(discussion, timeZone));
  }
}
