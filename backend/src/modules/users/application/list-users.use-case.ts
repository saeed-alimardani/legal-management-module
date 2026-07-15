import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildPaginatedResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

export interface ListUsersCommand {
  page: number;
  limit: number;
  role?: UserRole;
  isActive?: boolean;
}

@Injectable()
export class ListUsersUseCase {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, command: ListUsersCommand) {
    this.assertAdminOrManager(user);

    const { items, total } = await this.userRepository.list({
      page: command.page,
      limit: command.limit,
      role: command.role,
      isActive: command.isActive,
    });

    return buildPaginatedResponse(items, {
      page: command.page,
      limit: command.limit,
      total,
    });
  }

  private assertAdminOrManager(user: AuthenticatedUser): void {
    if (!this.accessControl.isAdminOrManager(user)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
