import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { CreateUserUseCase } from '../application/create-user.use-case';
import { GetUserUseCase } from '../application/get-user.use-case';
import { ListUserDirectoryUseCase } from '../application/list-user-directory.use-case';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { UpdateUserUseCase } from '../application/update-user.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly listUserDirectoryUseCase: ListUserDirectoryUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
  ) {}

  @Get('directory')
  @ApiOperation({
    summary: 'Active user id/name pairs for assignee and owner display',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  directory() {
    return this.listUserDirectoryUseCase.execute();
  }

  @Get()
  @Roles(UserRole.LEGAL_ADMIN)
  @ApiOperation({ summary: 'List users (filter by role, isActive)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.listUsersUseCase.execute(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      role: query.role,
      isActive: query.isActive,
    });
  }

  @Post()
  @Roles(UserRole.LEGAL_ADMIN)
  @ApiOperation({ summary: 'Create a user account' })
  @ApiConflictResponse({ description: 'Email already in use' })
  @ApiForbiddenResponse({ description: 'Insufficient role or permissions' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.createUserUseCase.execute(user, {
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      role: dto.role,
    });
  }

  @Get(':id')
  @Roles(UserRole.LEGAL_ADMIN)
  @ApiOperation({ summary: 'Get user detail' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Insufficient role' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getUserUseCase.execute(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.LEGAL_ADMIN)
  @ApiOperation({ summary: 'Update user fullName, role, or isActive' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Insufficient role or permissions' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.updateUserUseCase.execute(user, id, {
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive,
    });
  }
}
