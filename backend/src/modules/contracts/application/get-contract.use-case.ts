import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';
import {
  getContractResponseTimeZone,
  toContractResponse,
} from './contract.helpers';

@Injectable()
export class GetContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, contractId: string) {
    const contract = await this.contractRepository.findById(contractId);

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const involved = await this.contractRepository.isUserInvolved(
      contractId,
      user.id,
    );
    this.accessControl.assertCanViewMatter(user, contract.ownerId, involved);

    const timeZone = getContractResponseTimeZone(this.configService);
    return buildSingleResponse(toContractResponse(contract, timeZone));
  }
}
