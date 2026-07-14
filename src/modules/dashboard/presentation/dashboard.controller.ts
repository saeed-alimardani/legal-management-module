import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { GetDashboardSummaryUseCase } from '../application/get-dashboard-summary.use-case';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregated counts for the home dashboard view' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.getDashboardSummaryUseCase.execute(user);
  }
}
