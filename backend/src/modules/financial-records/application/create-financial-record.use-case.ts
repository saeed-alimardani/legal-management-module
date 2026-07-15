import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, Prisma } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { MatterInvolvementService } from '../../../shared/access-control/matter-involvement.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { FinancialRecordType } from '../domain/financial-record-type.enum';
import { PrismaFinancialRecordRepository } from '../infrastructure/prisma-financial-record.repository';
import {
  countParentRefs,
  resolveResponseTimeZone,
  toFinancialRecordResponse,
} from './financial-record.helpers';

export interface CreateFinancialRecordCommand {
  title: string;
  amount: number;
  currency?: string;
  type: FinancialRecordType;
  description?: string | null;
  recordDate: Date;
  caseId?: string | null;
  contractId?: string | null;
}

@Injectable()
export class CreateFinancialRecordUseCase {
  constructor(
    private readonly financialRecordRepository: PrismaFinancialRecordRepository,
    private readonly accessControl: AccessControlService,
    private readonly matterInvolvement: MatterInvolvementService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateFinancialRecordCommand) {
    if (countParentRefs(command) !== 1) {
      throw new BadRequestException(
        'Exactly one of caseId or contractId is required',
      );
    }

    const parent = await this.financialRecordRepository.findParentOwner({
      caseId: command.caseId,
      contractId: command.contractId,
    });

    if (!parent) {
      throw new NotFoundException('Parent matter not found');
    }

    const involved = await this.matterInvolvement.isUserInvolvedInParent(
      {
        caseId: command.caseId,
        contractId: command.contractId,
      },
      user.id,
    );
    this.accessControl.assertCanContributeToMatter(
      user,
      parent.ownerId,
      involved,
    );

    const recordDateUtc = toUtcDateOnly(command.recordDate);

    const record = await this.financialRecordRepository.create({
      title: command.title,
      amount: new Prisma.Decimal(command.amount),
      currency: command.currency ?? 'IRR',
      type: command.type,
      description: command.description,
      recordDate: recordDateUtc,
      caseId: command.caseId,
      contractId: command.contractId,
      createdById: user.id,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.FINANCIAL_RECORD,
      entityId: record.id,
      metadata: {
        title: record.title,
        amount: record.amount.toFixed(2),
        currency: record.currency,
        type: record.type,
        caseId: record.caseId,
        contractId: record.contractId,
      },
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toFinancialRecordResponse(record, timeZone));
  }
}
