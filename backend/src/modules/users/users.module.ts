import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateUserUseCase } from './application/create-user.use-case';
import { GetUserUseCase } from './application/get-user.use-case';
import { ListUserDirectoryUseCase } from './application/list-user-directory.use-case';
import { ListUsersUseCase } from './application/list-users.use-case';
import { UpdateUserUseCase } from './application/update-user.use-case';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    RolesGuard,
    PrismaUserRepository,
    ListUsersUseCase,
    ListUserDirectoryUseCase,
    CreateUserUseCase,
    GetUserUseCase,
    UpdateUserUseCase,
  ],
  exports: [PrismaUserRepository],
})
export class UsersModule {}
