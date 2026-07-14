import { Injectable } from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListContractsFilters } from '../domain/contract.types';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';

@Injectable()
export class ListContractsUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, filters: ListContractsFilters) {
    const scope = this.accessControl.buildOwnerListFilter(user);
    const { items, total } = await this.contractRepository.list(filters, scope);

    return buildPaginatedResponse(items, {
      page: filters.page,
      limit: filters.limit,
      total,
    });
  }
}
