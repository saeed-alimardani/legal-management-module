import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { BulkTransferOwnershipUseCase } from './application/bulk-transfer-ownership.use-case';
import { OffboardingController } from './presentation/offboarding.controller';

@Module({
  controllers: [OffboardingController],
  providers: [RolesGuard, BulkTransferOwnershipUseCase],
})
export class OffboardingModule {}
