import {
  Body,
  Controller,
  Delete,
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
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { CreateTaskUseCase } from '../application/create-task.use-case';
import { DeleteTaskUseCase } from '../application/delete-task.use-case';
import { GetTaskUseCase } from '../application/get-task.use-case';
import { ListTasksUseCase } from '../application/list-tasks.use-case';
import { UpdateTaskUseCase } from '../application/update-task.use-case';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly listTasksUseCase: ListTasksUseCase,
    private readonly getTaskUseCase: GetTaskUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly deleteTaskUseCase: DeleteTaskUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tasks (filter by assignee, status, parent)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.listTasksUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      assigneeId: query.assigneeId,
      status: query.status,
      caseId: query.caseId,
      contractId: query.contractId,
      noticeId: query.noticeId,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({ summary: 'Create a task on a parent matter' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.createTaskUseCase.execute(user, {
      title: dto.title,
      description: dto.description,
      status: dto.status,
      assigneeId: dto.assigneeId,
      dueDate: dto.dueDate !== undefined ? new Date(dto.dueDate) : undefined,
      caseId: dto.caseId,
      contractId: dto.contractId,
      noticeId: dto.noticeId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task detail' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getTaskUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({ summary: 'Update task fields or status' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.updateTaskUseCase.execute(user, id, {
      title: dto.title,
      description: dto.description,
      status: dto.status,
      assigneeId: dto.assigneeId,
      dueDate:
        dto.dueDate === undefined
          ? undefined
          : dto.dueDate === null
            ? null
            : new Date(dto.dueDate),
    });
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a task' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteTaskUseCase.execute(user, id);
  }
}
