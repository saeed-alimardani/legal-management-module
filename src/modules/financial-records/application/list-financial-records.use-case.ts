import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialRecordType } from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaFinancialRecordRepository } from '../infrastructure/prisma-financial-record.repository';
import {
  resolveResponseTimeZone,
  toFinancialRecordResponse,
} from './financial-record.helpers';

export interface ListFinancialRecordsCommand {
  caseId?: string;
  contractId?: string;
  type?: FinancialRecordType;
  page: number;
  limit: number;
}

@Injectable()
export class ListFinancialRecordsUseCase {
  constructor(
    private readonly financialRecordRepository: PrismaFinancialRecordRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListFinancialRecordsCommand) {
    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );
    const scope = this.accessControl.buildFinancialRecordListFilter(user);

    const { items, total } = await this.financialRecordRepository.list(
      {
        caseId: command.caseId,
        contractId: command.contractId,
        type: command.type,
        page: command.page,
        limit: command.limit,
      },
      scope,
    );

    return buildPaginatedResponse(
      items.map((item) => toFinancialRecordResponse(item, timeZone)),
      {
        page: command.page,
        limit: command.limit,
        total,
      },
    );
  }
}
