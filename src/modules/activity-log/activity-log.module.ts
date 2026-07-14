import { Module } from '@nestjs/common';
import { ListActivityLogsUseCase } from './application/list-activity-logs.use-case';
import { ActivityLogController } from './presentation/activity-log.controller';

@Module({
  controllers: [ActivityLogController],
  providers: [ListActivityLogsUseCase],
})
export class ActivityLogReadModule {}
