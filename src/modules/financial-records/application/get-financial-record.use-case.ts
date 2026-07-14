import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaFinancialRecordRepository } from '../infrastructure/prisma-financial-record.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toFinancialRecordResponse,
} from './financial-record.helpers';

@Injectable()
export class GetFinancialRecordUseCase {
  constructor(
    private readonly financialRecordRepository: PrismaFinancialRecordRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, recordId: string) {
    const record = await this.financialRecordRepository.findById(recordId);

    if (!record) {
      throw new NotFoundException('Financial record not found');
    }

    const parentOwnerId = resolveParentOwnerId(record);

    if (!parentOwnerId) {
      throw new NotFoundException('Financial record not found');
    }

    this.accessControl.assertCanView(user, { ownerId: parentOwnerId });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toFinancialRecordResponse(record, timeZone));
  }
}
