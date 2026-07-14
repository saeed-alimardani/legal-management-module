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
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { UpdateNoticeInput } from '../domain/notice.types';
import { PrismaNoticeRepository } from '../infrastructure/prisma-notice.repository';
import {
  resolveNoticeResponseTimeZone,
  toNoticeResponse,
} from './notice.helpers';

@Injectable()
export class UpdateNoticeUseCase {
  constructor(
    private readonly noticeRepository: PrismaNoticeRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    noticeId: string,
    command: UpdateNoticeInput,
  ) {
    const existing = await this.noticeRepository.findById(noticeId);

    if (!existing) {
      throw new NotFoundException('Notice not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: existing.ownerId });

    await this.assertRelatedMatterExists(command);

    const receivedDate =
      command.receivedDate !== undefined
        ? toUtcDateOnly(command.receivedDate)
        : existing.receivedDate;
    const responseDeadline =
      command.responseDeadline !== undefined
        ? toUtcDateOnly(command.responseDeadline)
        : existing.responseDeadline;

    if (responseDeadline.getTime() < toUtcDateOnly(receivedDate).getTime()) {
      throw new BadRequestException(
        'responseDeadline must be on or after receivedDate',
      );
    }

    const normalized: UpdateNoticeInput = {
      ...command,
      ...(command.receivedDate !== undefined
        ? { receivedDate: toUtcDateOnly(command.receivedDate) }
        : {}),
      ...(command.responseDeadline !== undefined
        ? { responseDeadline: toUtcDateOnly(command.responseDeadline) }
        : {}),
    };

    const updated = await this.noticeRepository.update(noticeId, normalized);
    const changedFields = this.getChangedFields(existing, normalized);

    if (changedFields.length === 0) {
      return this.toResponse(updated);
    }

    const statusChanged =
      command.status !== undefined && command.status !== existing.status;

    await this.activityLogService.log({
      actorId: user.id,
      action: statusChanged ? AuditAction.STATUS_CHANGED : AuditAction.UPDATED,
      entityType: EntityType.NOTICE,
      entityId: updated.id,
      metadata: statusChanged
        ? {
            from: existing.status,
            to: updated.status,
            fields: changedFields,
          }
        : {
            fields: changedFields,
          },
    });

    return this.toResponse(updated);
  }

  private toResponse(notice: Parameters<typeof toNoticeResponse>[0]) {
    const timeZone = resolveNoticeResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toNoticeResponse(notice, timeZone));
  }

  private async assertRelatedMatterExists(
    command: Pick<UpdateNoticeInput, 'relatedCaseId' | 'relatedContractId'>,
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

  private getChangedFields(
    existing: {
      title: string;
      sender: string;
      receivedDate: Date;
      responseDeadline: Date;
      status: UpdateNoticeInput['status'];
      description: string | null;
      relatedCaseId: string | null;
      relatedContractId: string | null;
    },
    command: UpdateNoticeInput,
  ): string[] {
    const changed: string[] = [];

    if (command.title !== undefined && command.title !== existing.title) {
      changed.push('title');
    }

    if (command.sender !== undefined && command.sender !== existing.sender) {
      changed.push('sender');
    }

    if (
      command.receivedDate !== undefined &&
      command.receivedDate.toISOString() !== existing.receivedDate.toISOString()
    ) {
      changed.push('receivedDate');
    }

    if (
      command.responseDeadline !== undefined &&
      command.responseDeadline.toISOString() !==
        existing.responseDeadline.toISOString()
    ) {
      changed.push('responseDeadline');
    }

    if (command.status !== undefined && command.status !== existing.status) {
      changed.push('status');
    }

    if (
      command.description !== undefined &&
      command.description !== existing.description
    ) {
      changed.push('description');
    }

    if (
      command.relatedCaseId !== undefined &&
      command.relatedCaseId !== existing.relatedCaseId
    ) {
      changed.push('relatedCaseId');
    }

    if (
      command.relatedContractId !== undefined &&
      command.relatedContractId !== existing.relatedContractId
    ) {
      changed.push('relatedContractId');
    }

    return changed;
  }
}
