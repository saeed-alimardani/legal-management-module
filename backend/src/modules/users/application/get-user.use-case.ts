import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

@Injectable()
export class GetUserUseCase {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly accessControl: AccessControlService,
  ) {}

  async execute(user: AuthenticatedUser, userId: string) {
    this.accessControl.assertCanManageUsers(user);

    const found = await this.userRepository.findById(userId);

    if (!found) {
      throw new NotFoundException('User not found');
    }

    return buildSingleResponse(found);
  }
}
