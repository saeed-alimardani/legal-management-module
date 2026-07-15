import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListContractsFilters } from '../domain/contract.types';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';
import {
  getContractResponseTimeZone,
  toContractResponse,
} from './contract.helpers';

@Injectable()
export class ListContractsUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, filters: ListContractsFilters) {
    const scope = this.accessControl.buildContractListScope(user);
    const { items, total } = await this.contractRepository.list(filters, scope);
    const timeZone = getContractResponseTimeZone(this.configService);

    return buildPaginatedResponse(
      items.map((item) => toContractResponse(item, timeZone)),
      {
        page: filters.page,
        limit: filters.limit,
        total,
      },
    );
  }
}
