import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { isValidContractDateRange } from '../domain/contract-date.rules';
import { UpdateContractInput } from '../domain/contract.types';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';
import {
  getContractResponseTimeZone,
  toContractResponse,
} from './contract.helpers';

@Injectable()
export class UpdateContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    contractId: string,
    command: UpdateContractInput,
  ) {
    const existing = await this.contractRepository.findById(contractId);

    if (!existing) {
      throw new NotFoundException('Contract not found');
    }

    this.accessControl.assertCanEdit(user, { ownerId: existing.ownerId });

    const effectiveDate =
      command.effectiveDate !== undefined
        ? command.effectiveDate
          ? toUtcDateOnly(command.effectiveDate)
          : null
        : existing.effectiveDate;
    const expirationDate =
      command.expirationDate !== undefined
        ? command.expirationDate
          ? toUtcDateOnly(command.expirationDate)
          : null
        : existing.expirationDate;

    if (!isValidContractDateRange(effectiveDate, expirationDate)) {
      throw new BadRequestException(
        'expirationDate must be on or after effectiveDate',
      );
    }

    const normalized: UpdateContractInput = {
      ...command,
      ...(command.effectiveDate !== undefined
        ? {
            effectiveDate: command.effectiveDate
              ? toUtcDateOnly(command.effectiveDate)
              : null,
          }
        : {}),
      ...(command.expirationDate !== undefined
        ? {
            expirationDate: command.expirationDate
              ? toUtcDateOnly(command.expirationDate)
              : null,
          }
        : {}),
      ...(command.renewalDate !== undefined
        ? {
            renewalDate: command.renewalDate
              ? toUtcDateOnly(command.renewalDate)
              : null,
          }
        : {}),
    };

    const updated = await this.contractRepository.update(
      contractId,
      normalized,
    );
    const changedFields = this.getChangedFields(existing, normalized);
    const timeZone = getContractResponseTimeZone(this.configService);

    if (changedFields.length === 0) {
      return buildSingleResponse(toContractResponse(updated, timeZone));
    }

    const statusChanged =
      command.status !== undefined && command.status !== existing.status;

    await this.activityLogService.log({
      actorId: user.id,
      action: statusChanged ? AuditAction.STATUS_CHANGED : AuditAction.UPDATED,
      entityType: EntityType.CONTRACT,
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

    return buildSingleResponse(toContractResponse(updated, timeZone));
  }

  private getChangedFields(
    existing: {
      title: string;
      type: UpdateContractInput['type'];
      status: UpdateContractInput['status'];
      counterpartyName: string;
      effectiveDate: Date | null;
      expirationDate: Date | null;
      renewalDate: Date | null;
      keyTerms: string | null;
    },
    command: UpdateContractInput,
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
      command.counterpartyName !== undefined &&
      command.counterpartyName !== existing.counterpartyName
    ) {
      changed.push('counterpartyName');
    }

    if (
      command.effectiveDate !== undefined &&
      command.effectiveDate?.toISOString() !==
        existing.effectiveDate?.toISOString()
    ) {
      changed.push('effectiveDate');
    }

    if (
      command.expirationDate !== undefined &&
      command.expirationDate?.toISOString() !==
        existing.expirationDate?.toISOString()
    ) {
      changed.push('expirationDate');
    }

    if (
      command.renewalDate !== undefined &&
      command.renewalDate?.toISOString() !== existing.renewalDate?.toISOString()
    ) {
      changed.push('renewalDate');
    }

    if (
      command.keyTerms !== undefined &&
      command.keyTerms !== existing.keyTerms
    ) {
      changed.push('keyTerms');
    }

    return changed;
  }
}
