import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { UpdateCaseInput } from '../domain/case.types';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';
import { getCaseResponseTimeZone, toCaseResponse } from './case.helpers';

@Injectable()
export class UpdateCaseUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    caseId: string,
    command: UpdateCaseInput,
  ) {
    const existing = await this.caseRepository.findById(caseId);

    if (!existing) {
      throw new NotFoundException('Case not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: existing.ownerId });

    const updated = await this.caseRepository.update(caseId, command);
    const changedFields = this.getChangedFields(existing, command);

    const timeZone = getCaseResponseTimeZone(this.configService);

    if (changedFields.length === 0) {
      return buildSingleResponse(toCaseResponse(updated, timeZone));
    }

    const statusChanged =
      command.status !== undefined && command.status !== existing.status;

    await this.activityLogService.log({
      actorId: user.id,
      action: statusChanged ? AuditAction.STATUS_CHANGED : AuditAction.UPDATED,
      entityType: EntityType.CASE,
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

    return buildSingleResponse(toCaseResponse(updated, timeZone));
  }

  private getChangedFields(
    existing: {
      title: string;
      type: UpdateCaseInput['type'];
      status: UpdateCaseInput['status'];
      priority: UpdateCaseInput['priority'];
      description: string | null;
      openedDate: Date | null;
      closedDate: Date | null;
    },
    command: UpdateCaseInput,
  ): string[] {
    const changed: string[] = [];

    if (command.title !== undefined && command.title !== existing.title) {
      changed.push('title');
    }

    if (command.type !== undefined && command.type !== existing.type) {
      changed.push('type');
    }

    if (command.status !== undefined && command.status !== existing.status) {
      changed.push('status');
    }

    if (
      command.priority !== undefined &&
      command.priority !== existing.priority
    ) {
      changed.push('priority');
    }

    if (
      command.description !== undefined &&
      command.description !== existing.description
    ) {
      changed.push('description');
    }

    if (
      command.openedDate !== undefined &&
      command.openedDate?.toISOString() !== existing.openedDate?.toISOString()
    ) {
      changed.push('openedDate');
    }

    if (
      command.closedDate !== undefined &&
      command.closedDate?.toISOString() !== existing.closedDate?.toISOString()
    ) {
      changed.push('closedDate');
    }

    return changed;
  }
}
