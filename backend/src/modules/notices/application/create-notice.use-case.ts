import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  DeadlineStatus,
  EntityType,
  NoticeStatus,
} from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { createDefaultReminder } from '../../reminders/application/reminder.helpers';
import { CreateNoticeInput } from '../domain/notice.types';
import { PrismaNoticeRepository } from '../infrastructure/prisma-notice.repository';
import {
  resolveNoticeResponseTimeZone,
  toNoticeResponse,
} from './notice.helpers';

export interface CreateNoticeCommand {
  title: string;
  sender: string;
  receivedDate: Date;
  responseDeadline: Date;
  status?: NoticeStatus;
  ownerId?: string;
  description?: string | null;
  relatedCaseId?: string | null;
  relatedContractId?: string | null;
}

/**
 * Creates a notice and its linked response deadline in one transaction.
 * Injects PrismaService directly — documented pragmatic exception for
 * cross-aggregate notice + deadline writes.
 */
@Injectable()
export class CreateNoticeUseCase {
  constructor(
    private readonly noticeRepository: PrismaNoticeRepository,
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateNoticeCommand) {
    this.accessControl.assertCanManageCoreEntities(user);

    const receivedDate = toUtcDateOnly(command.receivedDate);
    const responseDeadline = toUtcDateOnly(command.responseDeadline);

    if (responseDeadline.getTime() < receivedDate.getTime()) {
      throw new BadRequestException(
        'responseDeadline must be on or after receivedDate',
      );
    }

    await this.assertRelatedMatterExists(command);

    const ownerId = await this.resolveOwnerId(user, command.ownerId);
    const referenceCode =
      await this.noticeRepository.generateNextReferenceCode();
    const status = command.status ?? NoticeStatus.RECEIVED;

    const timeZone = resolveNoticeResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    const notice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.legalNotice.create({
        data: {
          referenceCode,
          title: command.title,
          sender: command.sender,
          receivedDate,
          responseDeadline,
          status,
          ownerId,
          description: command.description ?? null,
          relatedCaseId: command.relatedCaseId ?? null,
          relatedContractId: command.relatedContractId ?? null,
        },
      });

      const deadline = await tx.deadline.create({
        data: {
          title: `Response deadline: ${created.title}`,
          dueDate: responseDeadline,
          status: DeadlineStatus.PENDING,
          assigneeId: ownerId,
          noticeId: created.id,
          createdById: user.id,
        },
      });

      await this.activityLogService.logWithinTransaction(tx, {
        actorId: user.id,
        action: AuditAction.CREATED,
        entityType: EntityType.NOTICE,
        entityId: created.id,
        metadata: {
          referenceCode: created.referenceCode,
          title: created.title,
          responseDeadline: responseDeadline.toISOString().slice(0, 10),
          deadlineId: deadline.id,
        },
      });

      await this.activityLogService.logWithinTransaction(tx, {
        actorId: user.id,
        action: AuditAction.CREATED,
        entityType: EntityType.DEADLINE,
        entityId: deadline.id,
        metadata: {
          title: deadline.title,
          dueDate: responseDeadline.toISOString().slice(0, 10),
          noticeId: created.id,
          autoCreated: true,
        },
      });

      await tx.reminder.create({
        data: createDefaultReminder(
          deadline.id,
          responseDeadline,
          ownerId,
          user.id,
          timeZone,
        ),
      });

      return created;
    });

    return buildSingleResponse(toNoticeResponse(notice, timeZone));
  }

  private async assertRelatedMatterExists(
    command: Pick<CreateNoticeInput, 'relatedCaseId' | 'relatedContractId'>,
  ): Promise<void> {
    if (command.relatedCaseId) {
      const exists = await this.noticeRepository.relatedCaseExists(
        command.relatedCaseId,
      );
      if (!exists) {
        throw new NotFoundException('Related case not found');
      }
    }

    if (command.relatedContractId) {
      const exists = await this.noticeRepository.relatedContractExists(
        command.relatedContractId,
      );
      if (!exists) {
        throw new NotFoundException('Related contract not found');
      }
    }
  }

  private async resolveOwnerId(
    user: AuthenticatedUser,
    requestedOwnerId?: string,
  ): Promise<string> {
    if (!requestedOwnerId || requestedOwnerId === user.id) {
      return user.id;
    }

    if (!this.accessControl.isAdminOrManager(user)) {
      throw new BadRequestException(
        'Only admins and managers can assign a different owner',
      );
    }

    const ownerExists =
      await this.noticeRepository.userExistsAndActive(requestedOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('Owner user not found or inactive');
    }

    return requestedOwnerId;
  }
}
