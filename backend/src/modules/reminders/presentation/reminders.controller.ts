import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ReminderStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { CreateReminderUseCase } from '../application/create-reminder.use-case';
import { GetReminderUseCase } from '../application/get-reminder.use-case';
import { ListRemindersUseCase } from '../application/list-reminders.use-case';
import { ProcessDueRemindersUseCase } from '../application/process-due-reminders.use-case';
import { UpdateReminderUseCase } from '../application/update-reminder.use-case';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly createReminderUseCase: CreateReminderUseCase,
    private readonly listRemindersUseCase: ListRemindersUseCase,
    private readonly getReminderUseCase: GetReminderUseCase,
    private readonly updateReminderUseCase: UpdateReminderUseCase,
    private readonly processDueRemindersUseCase: ProcessDueRemindersUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List reminders with optional view filter',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRemindersQueryDto,
  ) {
    return this.listRemindersUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      view: query.view,
      status: query.status,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Create a reminder for a deadline' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReminderDto,
  ) {
    return this.createReminderUseCase.execute(user, {
      deadlineId: dto.deadlineId,
      remindAt: new Date(dto.remindAt),
      message: dto.message,
    });
  }

  @Post('process-due')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all due pending reminders as sent (admin/manager only)',
  })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  processDue(@CurrentUser() user: AuthenticatedUser) {
    return this.processDueRemindersUseCase.execute(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reminder detail' })
  @ApiNotFoundResponse({ description: 'Reminder not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getReminderUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Update remindAt, message, or dismiss a reminder' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.updateReminderUseCase.execute(user, id, {
      remindAt: dto.remindAt !== undefined ? new Date(dto.remindAt) : undefined,
      message: dto.message,
      status: dto.status as ReminderStatus | undefined,
    });
  }
}
