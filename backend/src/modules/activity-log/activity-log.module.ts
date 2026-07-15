import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ListActivityLogsUseCase } from './application/list-activity-logs.use-case';
import { ActivityLogController } from './presentation/activity-log.controller';

@Module({
  controllers: [ActivityLogController],
  providers: [RolesGuard, ListActivityLogsUseCase],
})
export class ActivityLogReadModule {}
