import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateFinancialRecordUseCase } from './application/create-financial-record.use-case';
import { DeleteFinancialRecordUseCase } from './application/delete-financial-record.use-case';
import { GetFinancialRecordUseCase } from './application/get-financial-record.use-case';
import { ListFinancialRecordsUseCase } from './application/list-financial-records.use-case';
import { UpdateFinancialRecordUseCase } from './application/update-financial-record.use-case';
import { PrismaFinancialRecordRepository } from './infrastructure/prisma-financial-record.repository';
import { FinancialRecordsController } from './presentation/financial-records.controller';

@Module({
  controllers: [FinancialRecordsController],
  providers: [
    RolesGuard,
    PrismaFinancialRecordRepository,
    CreateFinancialRecordUseCase,
    ListFinancialRecordsUseCase,
    GetFinancialRecordUseCase,
    UpdateFinancialRecordUseCase,
    DeleteFinancialRecordUseCase,
  ],
  exports: [PrismaFinancialRecordRepository],
})
export class FinancialRecordsModule {}
