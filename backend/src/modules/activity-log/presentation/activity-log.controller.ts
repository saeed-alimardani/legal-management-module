import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListActivityLogsUseCase } from '../application/list-activity-logs.use-case';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity-logs')
export class ActivityLogController {
  constructor(
    private readonly listActivityLogsUseCase: ListActivityLogsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List activity logs (case timeline via entityType + entityId)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListActivityLogsQueryDto,
  ) {
    return this.listActivityLogsUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
    });
  }
}
