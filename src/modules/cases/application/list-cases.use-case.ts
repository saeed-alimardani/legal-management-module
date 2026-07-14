import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListCasesFilters } from '../domain/case.types';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';
import { getCaseResponseTimeZone, toCaseResponse } from './case.helpers';

@Injectable()
export class ListCasesUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, filters: ListCasesFilters) {
    const scope = this.accessControl.buildOwnerListFilter(user);
    const { items, total } = await this.caseRepository.list(filters, scope);
    const timeZone = getCaseResponseTimeZone(this.configService);

    return buildPaginatedResponse(
      items.map((item) => toCaseResponse(item, timeZone)),
      {
        page: filters.page,
        limit: filters.limit,
        total,
      },
    );
  }
}
