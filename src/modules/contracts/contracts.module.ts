import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateContractUseCase } from './application/create-contract.use-case';
import { DeleteContractUseCase } from './application/delete-contract.use-case';
import { GetContractUseCase } from './application/get-contract.use-case';
import { ListContractsUseCase } from './application/list-contracts.use-case';
import { ReassignContractUseCase } from './application/reassign-contract.use-case';
import { UpdateContractUseCase } from './application/update-contract.use-case';
import { PrismaContractRepository } from './infrastructure/prisma-contract.repository';
import { ContractsController } from './presentation/contracts.controller';

@Module({
  controllers: [ContractsController],
  providers: [
    RolesGuard,
    PrismaContractRepository,
    CreateContractUseCase,
    ListContractsUseCase,
    GetContractUseCase,
    UpdateContractUseCase,
    DeleteContractUseCase,
    ReassignContractUseCase,
  ],
  exports: [PrismaContractRepository],
})
export class ContractsModule {}
