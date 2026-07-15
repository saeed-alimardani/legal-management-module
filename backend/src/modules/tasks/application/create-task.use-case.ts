import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, TaskStatus } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { PrismaTaskRepository } from '../infrastructure/prisma-task.repository';
import {
  countParentRefs,
  resolveResponseTimeZone,
  toTaskResponse,
} from './task.helpers';

export interface CreateTaskCommand {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId: string;
  dueDate?: Date | null;
  caseId?: string | null;
  contractId?: string | null;
  noticeId?: string | null;
}

@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly taskRepository: PrismaTaskRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateTaskCommand) {
    this.accessControl.assertCanManageCoreEntities(user);

    if (countParentRefs(command) !== 1) {
      throw new BadRequestException(
        'Exactly one of caseId, contractId, or noticeId is required',
      );
    }

    const parent = await this.taskRepository.findParentOwner({
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
    });

    if (!parent) {
      throw new NotFoundException('Parent matter not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: parent.ownerId });

    const assigneeExists = await this.taskRepository.userExistsAndActive(
      command.assigneeId,
    );

    if (!assigneeExists) {
      throw new NotFoundException('Assignee user not found or inactive');
    }

    const dueDateUtc =
      command.dueDate !== undefined && command.dueDate !== null
        ? toUtcDateOnly(command.dueDate)
        : null;

    const task = await this.taskRepository.create({
      title: command.title,
      description: command.description,
      status: command.status ?? TaskStatus.TODO,
      assigneeId: command.assigneeId,
      dueDate: dueDateUtc,
      caseId: command.caseId,
      contractId: command.contractId,
      noticeId: command.noticeId,
      createdById: user.id,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.TASK,
      entityId: task.id,
      metadata: {
        title: task.title,
        assigneeId: task.assigneeId,
        caseId: task.caseId,
        contractId: task.contractId,
        noticeId: task.noticeId,
      },
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toTaskResponse(task, timeZone));
  }
}
