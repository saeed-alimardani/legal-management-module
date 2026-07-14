import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';
import { getCaseResponseTimeZone, toCaseResponse } from './case.helpers';

@Injectable()
export class GetCaseUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, caseId: string) {
    const legalCase = await this.caseRepository.findById(caseId);

    if (!legalCase) {
      throw new NotFoundException('Case not found');
    }

    this.accessControl.assertCanView(user, { ownerId: legalCase.ownerId });

    const timeZone = getCaseResponseTimeZone(this.configService);
    return buildSingleResponse(toCaseResponse(legalCase, timeZone));
  }
}
