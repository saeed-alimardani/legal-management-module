import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, DeadlineStatus, EntityType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { MatterInvolvementService } from '../../../shared/access-control/matter-involvement.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { createDefaultReminder } from '../../reminders/application/reminder.helpers';
import { PrismaReminderRepository } from '../../reminders/infrastructure/prisma-reminder.repository';
import { PrismaDeadlineRepository } from '../infrastructure/prisma-deadline.repository';
import {
  countParentRefs,
  resolveResponseTimeZone,
  toDeadlineResponse,
} from './deadline.helpers';

export interface CreateDeadlineCommand {
  title: string;
  dueDate: Date;
  status?: DeadlineStatus;
  assigneeId?: string | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

@Injectable()
export class CreateDeadlineUseCase {
  constructor(
    private readonly deadlineRepository: PrismaDeadlineRepository,
    private readonly reminderRepository: PrismaReminderRepository,
    private readonly accessControl: AccessControlService,
    private readonly matterInvolvement: MatterInvolvementService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateDeadlineCommand) {
    if (countParentRefs(command) !== 1) {
      throw new BadRequestException(
        'Exactly one of caseId, contractId, or noticeId is required',
      );
    }

    const parent = await this.deadlineRepository.findParentOwner({
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
    });

    if (!parent) {
      throw new NotFoundException('Parent matter not found');
    }

    const involved = await this.matterInvolvement.isUserInvolvedInParent(
      {
        caseId: command.caseId,
        contractId: command.contractId,
        noticeId: command.noticeId,
      },
      user.id,
    );
    this.accessControl.assertCanContributeToMatter(
      user,
      parent.ownerId,
      involved,
    );

    if (command.assigneeId) {
      const assigneeExists = await this.deadlineRepository.userExistsAndActive(
        command.assigneeId,
      );

      if (!assigneeExists) {
        throw new NotFoundException('Assignee user not found or inactive');
      }
    }

    const dueDateUtc = toUtcDateOnly(command.dueDate);

    const deadline = await this.deadlineRepository.create({
      title: command.title,
      dueDate: dueDateUtc,
      status: command.status ?? DeadlineStatus.PENDING,
      assigneeId: command.assigneeId,
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
      createdById: user.id,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.DEADLINE,
      entityId: deadline.id,
      metadata: {
        title: deadline.title,
        dueDate: dueDateUtc.toISOString().slice(0, 10),
        caseId: deadline.caseId,
        contractId: deadline.contractId,
        noticeId: deadline.noticeId,
      },
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    await this.reminderRepository.create(
      createDefaultReminder(
        deadline.id,
        deadline.dueDate,
        deadline.assigneeId,
        user.id,
        timeZone,
      ),
    );

    return buildSingleResponse(toDeadlineResponse(deadline, timeZone));
  }
}
