import { Injectable } from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListCasesFilters } from '../domain/case.types';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class ListCasesUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, filters: ListCasesFilters) {
    const scope = this.accessControl.buildOwnerListFilter(user);
    const { items, total } = await this.caseRepository.list(filters, scope);

    return buildPaginatedResponse(items, {
      page: filters.page,
      limit: filters.limit,
      total,
    });
  }
}
