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
import { AddPartyUseCase } from '../application/add-party.use-case';
import { CreateCaseUseCase } from '../application/create-case.use-case';
import { DeleteCaseUseCase } from '../application/delete-case.use-case';
import { DeletePartyUseCase } from '../application/delete-party.use-case';
import { GetCaseTimelineUseCase } from '../application/get-case-timeline.use-case';
import { GetCaseUseCase } from '../application/get-case.use-case';
import { ListCasesUseCase } from '../application/list-cases.use-case';
import { ListPartiesUseCase } from '../application/list-parties.use-case';
import { ReassignCaseUseCase } from '../application/reassign-case.use-case';
import { UpdateCaseUseCase } from '../application/update-case.use-case';
import { UpdatePartyUseCase } from '../application/update-party.use-case';
import { AddPartyDto } from './dto/add-party.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { ListCasesQueryDto } from './dto/list-cases-query.dto';
import { ReassignCaseDto } from './dto/reassign-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { UpdatePartyDto } from './dto/update-party.dto';

@ApiTags('Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(
    private readonly createCaseUseCase: CreateCaseUseCase,
    private readonly listCasesUseCase: ListCasesUseCase,
    private readonly getCaseUseCase: GetCaseUseCase,
    private readonly updateCaseUseCase: UpdateCaseUseCase,
    private readonly deleteCaseUseCase: DeleteCaseUseCase,
    private readonly reassignCaseUseCase: ReassignCaseUseCase,
    private readonly listPartiesUseCase: ListPartiesUseCase,
    private readonly addPartyUseCase: AddPartyUseCase,
    private readonly updatePartyUseCase: UpdatePartyUseCase,
    private readonly deletePartyUseCase: DeletePartyUseCase,
    private readonly getCaseTimelineUseCase: GetCaseTimelineUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List cases with pagination and filters' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCasesQueryDto,
  ) {
    return this.listCasesUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      type: query.type,
      ownerId: query.ownerId,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Create a new case with optional parties' })
  @ApiForbiddenResponse({ description: 'Insufficient role permissions' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCaseDto) {
    return this.createCaseUseCase.execute(user, {
      title: dto.title,
      type: dto.type,
      status: dto.status,
      priority: dto.priority,
      ownerId: dto.ownerId,
      description: dto.description,
      openedDate: dto.openedDate ? new Date(dto.openedDate) : undefined,
      closedDate: dto.closedDate ? new Date(dto.closedDate) : undefined,
      parties: dto.parties,
    });
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Case activity timeline' })
  getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCasesQueryDto,
  ) {
    return this.getCaseTimelineUseCase.execute(
      user,
      id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case detail with parties' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getCaseUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Update case fields or status' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseDto,
  ) {
    return this.updateCaseUseCase.execute(user, id, {
      title: dto.title,
      type: dto.type,
      status: dto.status,
      priority: dto.priority,
      description: dto.description,
      openedDate:
        dto.openedDate !== undefined
          ? dto.openedDate
            ? new Date(dto.openedDate)
            : null
          : undefined,
      closedDate:
        dto.closedDate !== undefined
          ? dto.closedDate
            ? new Date(dto.closedDate)
            : null
          : undefined,
    });
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a case' })
  @ApiForbiddenResponse({ description: 'Only admins and managers can delete' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteCaseUseCase.execute(user, id);
  }

  @Post(':id/reassign')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({ summary: 'Reassign case ownership' })
  @ApiForbiddenResponse({
    description: 'Only admins and managers can reassign',
  })
  reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignCaseDto,
  ) {
    return this.reassignCaseUseCase.execute(user, id, dto.ownerId);
  }

  @Get(':id/parties')
  @ApiOperation({ summary: 'List parties for a case' })
  listParties(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listPartiesUseCase.execute(user, id);
  }

  @Post(':id/parties')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Add a party to a case' })
  addParty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPartyDto,
  ) {
    return this.addPartyUseCase.execute(user, id, dto);
  }

  @Patch(':id/parties/:partyId')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Update a case party' })
  updateParty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partyId', ParseUUIDPipe) partyId: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.updatePartyUseCase.execute(user, id, partyId, dto);
  }

  @Delete(':id/parties/:partyId')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a party from a case' })
  deleteParty(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partyId', ParseUUIDPipe) partyId: string,
  ) {
    return this.deletePartyUseCase.execute(user, id, partyId);
  }
}
