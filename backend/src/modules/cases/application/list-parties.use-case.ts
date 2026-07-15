import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

@Injectable()
export class ListPartiesUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, caseId: string) {
    const legalCase = await this.caseRepository.findById(caseId);

    if (!legalCase) {
      throw new NotFoundException('Case not found');
    }

    this.accessControl.assertCanView(user, { ownerId: legalCase.ownerId });

    const parties = await this.caseRepository.listParties(caseId);

    return buildSingleResponse(parties);
  }
}
