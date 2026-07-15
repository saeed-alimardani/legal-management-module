import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, FinancialRecordType, Prisma } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { PrismaFinancialRecordRepository } from '../infrastructure/prisma-financial-record.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toFinancialRecordResponse,
} from './financial-record.helpers';

export interface UpdateFinancialRecordCommand {
  title?: string;
  amount?: number;
  currency?: string;
  type?: FinancialRecordType;
  description?: string | null;
  recordDate?: Date;
}

@Injectable()
export class UpdateFinancialRecordUseCase {
  constructor(
    private readonly financialRecordRepository: PrismaFinancialRecordRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    recordId: string,
    command: UpdateFinancialRecordCommand,
  ) {
    this.accessControl.assertCanMutate(user);

    const existing = await this.financialRecordRepository.findById(recordId);

    if (!existing) {
      throw new NotFoundException('Financial record not found');
    }

    const parentOwnerId = resolveParentOwnerId(existing);

    if (!parentOwnerId) {
      throw new NotFoundException('Financial record not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: parentOwnerId });

    const updateInput = {
      ...(command.title !== undefined ? { title: command.title } : {}),
      ...(command.amount !== undefined
        ? { amount: new Prisma.Decimal(command.amount) }
        : {}),
      ...(command.currency !== undefined ? { currency: command.currency } : {}),
      ...(command.type !== undefined ? { type: command.type } : {}),
      ...(command.description !== undefined
        ? { description: command.description }
        : {}),
      ...(command.recordDate !== undefined
        ? { recordDate: toUtcDateOnly(command.recordDate) }
        : {}),
    };

    const updated = await this.financialRecordRepository.update(
      recordId,
      updateInput,
    );

    const changedFields = this.getChangedFields(existing, command);
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    if (changedFields.length === 0) {
      return buildSingleResponse(toFinancialRecordResponse(updated, timeZone));
    }

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.FINANCIAL_RECORD,
      entityId: updated.id,
      metadata: { fields: changedFields },
    });

    return buildSingleResponse(toFinancialRecordResponse(updated, timeZone));
  }

  private getChangedFields(
    existing: {
      title: string;
      amount: Prisma.Decimal;
      currency: string;
      type: FinancialRecordType;
      description: string | null;
      recordDate: Date;
    },
    command: UpdateFinancialRecordCommand,
  ): string[] {
    const changed: string[] = [];

    if (command.title !== undefined && command.title !== existing.title) {
      changed.push('title');
    }

    if (
      command.amount !== undefined &&
      !new Prisma.Decimal(command.amount).equals(existing.amount)
    ) {
      changed.push('amount');
    }

    if (
      command.currency !== undefined &&
      command.currency !== existing.currency
    ) {
      changed.push('currency');
    }

    if (command.type !== undefined && command.type !== existing.type) {
      changed.push('type');
    }

    if (
      command.description !== undefined &&
      command.description !== existing.description
    ) {
      changed.push('description');
    }

    if (command.recordDate !== undefined) {
      const next = toUtcDateOnly(command.recordDate).toISOString();
      const current = toUtcDateOnly(existing.recordDate).toISOString();

      if (next !== current) {
        changed.push('recordDate');
      }
    }

    return changed;
  }
}
