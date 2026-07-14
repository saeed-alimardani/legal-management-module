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
import { CreateDiscussionUseCase } from '../application/create-discussion.use-case';
import { DeleteDiscussionUseCase } from '../application/delete-discussion.use-case';
import { GetDiscussionUseCase } from '../application/get-discussion.use-case';
import { ListDiscussionsUseCase } from '../application/list-discussions.use-case';
import { UpdateDiscussionUseCase } from '../application/update-discussion.use-case';
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { ListDiscussionsQueryDto } from './dto/list-discussions-query.dto';
import { UpdateDiscussionDto } from './dto/update-discussion.dto';

@ApiTags('Discussions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discussions')
export class DiscussionsController {
  constructor(
    private readonly createDiscussionUseCase: CreateDiscussionUseCase,
    private readonly listDiscussionsUseCase: ListDiscussionsUseCase,
    private readonly getDiscussionUseCase: GetDiscussionUseCase,
    private readonly updateDiscussionUseCase: UpdateDiscussionUseCase,
    private readonly deleteDiscussionUseCase: DeleteDiscussionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List discussions (filter by parent)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDiscussionsQueryDto,
  ) {
    return this.listDiscussionsUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      caseId: query.caseId,
      contractId: query.contractId,
      noticeId: query.noticeId,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Create a discussion on a parent matter' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiscussionDto,
  ) {
    return this.createDiscussionUseCase.execute(user, {
      content: dto.content,
      caseId: dto.caseId,
      contractId: dto.contractId,
      noticeId: dto.noticeId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discussion detail' })
  @ApiNotFoundResponse({ description: 'Discussion not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getDiscussionUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Update discussion content' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscussionDto,
  ) {
    return this.updateDiscussionUseCase.execute(user, id, {
      content: dto.content,
    });
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a discussion' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteDiscussionUseCase.execute(user, id);
  }
}
