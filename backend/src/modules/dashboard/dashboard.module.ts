import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { GetDashboardSummaryUseCase } from './application/get-dashboard-summary.use-case';
import { DashboardController } from './presentation/dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [RolesGuard, GetDashboardSummaryUseCase],
})
export class DashboardModule {}
