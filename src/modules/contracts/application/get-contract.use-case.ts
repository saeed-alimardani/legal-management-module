import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';

@Injectable()
export class GetContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, contractId: string) {
    const contract = await this.contractRepository.findById(contractId);

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    this.accessControl.assertCanView(user, { ownerId: contract.ownerId });

    return buildSingleResponse(contract);
  }
}
