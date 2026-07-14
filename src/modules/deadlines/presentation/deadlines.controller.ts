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
import { CreateDeadlineUseCase } from '../application/create-deadline.use-case';
import { DeleteDeadlineUseCase } from '../application/delete-deadline.use-case';
import { GetDeadlineUseCase } from '../application/get-deadline.use-case';
import { ListDeadlinesUseCase } from '../application/list-deadlines.use-case';
import { UpdateDeadlineUseCase } from '../application/update-deadline.use-case';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { ListDeadlinesQueryDto } from './dto/list-deadlines-query.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';

@ApiTags('Deadlines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deadlines')
export class DeadlinesController {
  constructor(
    private readonly createDeadlineUseCase: CreateDeadlineUseCase,
    private readonly listDeadlinesUseCase: ListDeadlinesUseCase,
    private readonly getDeadlineUseCase: GetDeadlineUseCase,
    private readonly updateDeadlineUseCase: UpdateDeadlineUseCase,
    private readonly deleteDeadlineUseCase: DeleteDeadlineUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List deadlines with optional view filter',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDeadlinesQueryDto,
  ) {
    return this.listDeadlinesUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      view: query.view,
    });
  }

  @Post()
  @Roles(
    UserRole.LEGAL_ADMIN,
    UserRole.LEGAL_MANAGER,
    UserRole.LEGAL_COUNSEL,
  )
  @ApiOperation({ summary: 'Create a deadline on a parent matter' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeadlineDto,
  ) {
    return this.createDeadlineUseCase.execute(user, {
      title: dto.title,
      dueDate: new Date(dto.dueDate),
      status: dto.status,
      assigneeId: dto.assigneeId,
      caseId: dto.caseId,
      contractId: dto.contractId,
      noticeId: dto.noticeId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deadline detail' })
  @ApiNotFoundResponse({ description: 'Deadline not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getDeadlineUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(
    UserRole.LEGAL_ADMIN,
    UserRole.LEGAL_MANAGER,
    UserRole.LEGAL_COUNSEL,
  )
  @ApiOperation({ summary: 'Update or complete a deadline' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeadlineDto,
  ) {
    return this.updateDeadlineUseCase.execute(user, id, {
      title: dto.title,
      dueDate: dto.dueDate !== undefined ? new Date(dto.dueDate) : undefined,
      status: dto.status,
      assigneeId: dto.assigneeId,
    });
  }

  @Delete(':id')
  @Roles(
    UserRole.LEGAL_ADMIN,
    UserRole.LEGAL_MANAGER,
    UserRole.LEGAL_COUNSEL,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a deadline (status=CANCELLED)' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteDeadlineUseCase.execute(user, id);
  }
}
