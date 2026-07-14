import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AddPartyUseCase } from './application/add-party.use-case';
import { CreateCaseUseCase } from './application/create-case.use-case';
import { DeleteCaseUseCase } from './application/delete-case.use-case';
import { GetCaseUseCase } from './application/get-case.use-case';
import { ListCasesUseCase } from './application/list-cases.use-case';
import { ListPartiesUseCase } from './application/list-parties.use-case';
import { ReassignCaseUseCase } from './application/reassign-case.use-case';
import { UpdateCaseUseCase } from './application/update-case.use-case';
import { PrismaCaseRepository } from './infrastructure/prisma-case.repository';
import { CasesController } from './presentation/cases.controller';

@Module({
  controllers: [CasesController],
  providers: [
    RolesGuard,
    PrismaCaseRepository,
    CreateCaseUseCase,
    ListCasesUseCase,
    GetCaseUseCase,
    UpdateCaseUseCase,
    DeleteCaseUseCase,
    ReassignCaseUseCase,
    ListPartiesUseCase,
    AddPartyUseCase,
  ],
  exports: [PrismaCaseRepository],
})
export class CasesModule {}
