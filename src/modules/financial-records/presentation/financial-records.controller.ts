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
import { CreateFinancialRecordUseCase } from '../application/create-financial-record.use-case';
import { DeleteFinancialRecordUseCase } from '../application/delete-financial-record.use-case';
import { GetFinancialRecordUseCase } from '../application/get-financial-record.use-case';
import { ListFinancialRecordsUseCase } from '../application/list-financial-records.use-case';
import { UpdateFinancialRecordUseCase } from '../application/update-financial-record.use-case';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { ListFinancialRecordsQueryDto } from './dto/list-financial-records-query.dto';
import { UpdateFinancialRecordDto } from './dto/update-financial-record.dto';

@ApiTags('Financial Records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-records')
export class FinancialRecordsController {
  constructor(
    private readonly createFinancialRecordUseCase: CreateFinancialRecordUseCase,
    private readonly listFinancialRecordsUseCase: ListFinancialRecordsUseCase,
    private readonly getFinancialRecordUseCase: GetFinancialRecordUseCase,
    private readonly updateFinancialRecordUseCase: UpdateFinancialRecordUseCase,
    private readonly deleteFinancialRecordUseCase: DeleteFinancialRecordUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List financial records (filter by parent, type)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFinancialRecordsQueryDto,
  ) {
    return this.listFinancialRecordsUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      caseId: query.caseId,
      contractId: query.contractId,
      type: query.type,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Create a financial record on a case or contract' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinancialRecordDto,
  ) {
    return this.createFinancialRecordUseCase.execute(user, {
      title: dto.title,
      amount: dto.amount,
      currency: dto.currency,
      type: dto.type,
      description: dto.description,
      recordDate: new Date(dto.recordDate),
      caseId: dto.caseId,
      contractId: dto.contractId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get financial record detail' })
  @ApiNotFoundResponse({ description: 'Financial record not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getFinancialRecordUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Update financial record fields' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialRecordDto,
  ) {
    return this.updateFinancialRecordUseCase.execute(user, id, {
      title: dto.title,
      amount: dto.amount,
      currency: dto.currency,
      type: dto.type,
      description: dto.description,
      recordDate:
        dto.recordDate !== undefined ? new Date(dto.recordDate) : undefined,
    });
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a financial record' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteFinancialRecordUseCase.execute(user, id);
  }
}
