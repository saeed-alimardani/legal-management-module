import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { ListActivityLogsUseCase } from '../application/list-activity-logs.use-case';
import { ListActivityLogsQueryDto } from './dto/list-activity-logs-query.dto';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activity-logs')
export class ActivityLogController {
  constructor(
    private readonly listActivityLogsUseCase: ListActivityLogsUseCase,
  ) {}

  @Get()
  @Roles(UserRole.LEGAL_ADMIN)
  @ApiOperation({
    summary: 'List activity logs (admin only)',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
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
