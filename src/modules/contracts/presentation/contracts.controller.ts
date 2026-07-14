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
import { CreateContractUseCase } from '../application/create-contract.use-case';
import { DeleteContractUseCase } from '../application/delete-contract.use-case';
import { GetContractUseCase } from '../application/get-contract.use-case';
import { ListContractsUseCase } from '../application/list-contracts.use-case';
import { ReassignContractUseCase } from '../application/reassign-contract.use-case';
import { UpdateContractUseCase } from '../application/update-contract.use-case';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { ReassignContractDto } from './dto/reassign-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly createContractUseCase: CreateContractUseCase,
    private readonly listContractsUseCase: ListContractsUseCase,
    private readonly getContractUseCase: GetContractUseCase,
    private readonly updateContractUseCase: UpdateContractUseCase,
    private readonly deleteContractUseCase: DeleteContractUseCase,
    private readonly reassignContractUseCase: ReassignContractUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List contracts with pagination and filters' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListContractsQueryDto,
  ) {
    return this.listContractsUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      type: query.type,
      ownerId: query.ownerId,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Create a new contract' })
  @ApiForbiddenResponse({ description: 'Insufficient role permissions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.createContractUseCase.execute(user, {
      title: dto.title,
      type: dto.type,
      status: dto.status,
      ownerId: dto.ownerId,
      counterpartyName: dto.counterpartyName,
      effectiveDate: dto.effectiveDate
        ? new Date(dto.effectiveDate)
        : undefined,
      expirationDate: dto.expirationDate
        ? new Date(dto.expirationDate)
        : undefined,
      renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : undefined,
      keyTerms: dto.keyTerms,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract detail' })
  @ApiNotFoundResponse({ description: 'Contract not found' })
  @ApiForbiddenResponse({ description: 'Access denied' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getContractUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER, UserRole.LEGAL_COUNSEL)
  @ApiOperation({ summary: 'Update contract fields or status' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.updateContractUseCase.execute(user, id, {
      title: dto.title,
      type: dto.type,
      status: dto.status,
      counterpartyName: dto.counterpartyName,
      effectiveDate:
        dto.effectiveDate !== undefined
          ? dto.effectiveDate
            ? new Date(dto.effectiveDate)
            : null
          : undefined,
      expirationDate:
        dto.expirationDate !== undefined
          ? dto.expirationDate
            ? new Date(dto.expirationDate)
            : null
          : undefined,
      renewalDate:
        dto.renewalDate !== undefined
          ? dto.renewalDate
            ? new Date(dto.renewalDate)
            : null
          : undefined,
      keyTerms: dto.keyTerms,
    });
  }

  @Delete(':id')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a contract' })
  @ApiForbiddenResponse({ description: 'Only admins and managers can delete' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteContractUseCase.execute(user, id);
  }

  @Post(':id/reassign')
  @Roles(UserRole.LEGAL_ADMIN, UserRole.LEGAL_MANAGER)
  @ApiOperation({ summary: 'Reassign contract ownership' })
  @ApiForbiddenResponse({
    description: 'Only admins and managers can reassign',
  })
  reassign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignContractDto,
  ) {
    return this.reassignContractUseCase.execute(user, id, dto.ownerId);
  }
}
