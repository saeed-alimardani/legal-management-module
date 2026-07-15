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
import { CreateNoticeUseCase } from '../application/create-notice.use-case';
import { DeleteNoticeUseCase } from '../application/delete-notice.use-case';
import { GetNoticeUseCase } from '../application/get-notice.use-case';
import { ListNoticesUseCase } from '../application/list-notices.use-case';
import { ReassignNoticeUseCase } from '../application/reassign-notice.use-case';
import { UpdateNoticeUseCase } from '../application/update-notice.use-case';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { ListNoticesQueryDto } from './dto/list-notices-query.dto';
import { ReassignNoticeDto } from './dto/reassign-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

@ApiTags('Notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notices')
export class NoticesController {
  constructor(
    private readonly createNoticeUseCase: CreateNoticeUseCase,
    private readonly listNoticesUseCase: ListNoticesUseCase,
    private readonly getNoticeUseCase: GetNoticeUseCase,
    private readonly updateNoticeUseCase: UpdateNoticeUseCase,
    private readonly deleteNoticeUseCase: DeleteNoticeUseCase,
    private readonly reassignNoticeUseCase: ReassignNoticeUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notices with pagination and filters' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNoticesQueryDto,
  ) {
    return this.listNoticesUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      ownerId: query.ownerId,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({
    summary: 'Register a notice and auto-create its response deadline',
  })
  @ApiForbiddenResponse({ description: 'Insufficient role permissions' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNoticeDto) {
    return this.createNoticeUseCase.execute(user, {
      title: dto.title,
      sender: dto.sender,
      receivedDate: new Date(dto.receivedDate),
      responseDeadline: new Date(dto.responseDeadline),
      status: dto.status,
      ownerId: dto.ownerId,
      description: dto.description,
      relatedCaseId: dto.relatedCaseId,
      relatedContractId: dto.relatedContractId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notice detail' })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getNoticeUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({ summary: 'Update notice fields or status' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.updateNoticeUseCase.execute(user, id, {
      title: dto.title,
      sender: dto.sender,
      receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : undefined,
      responseDeadline: dto.responseDeadline
        ? new Date(dto.responseDeadline)
        : undefined,
      status: dto.status,
      description: dto.description,
      relatedCaseId: dto.relatedCaseId,
      relatedContractId: dto.relatedContractId,
    });
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a notice' })
  @ApiForbiddenResponse({ description: 'Only admins and managers can delete' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteNoticeUseCase.execute(user, id);
  }

  @Post(':id/reassign')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({ summary: 'Reassign notice ownership' })
  @ApiForbiddenResponse({
    description: 'Only admins and managers can reassign',
  })
  reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignNoticeDto,
  ) {
    return this.reassignNoticeUseCase.execute(user, id, dto.ownerId);
  }
}
