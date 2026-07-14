import { Injectable, NotFoundException } from '@nestjs/common';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthUserResponse } from '../domain/auth.types';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

@Injectable()
export class GetMeUseCase {
  constructor(private readonly userRepository: PrismaUserRepository) {}

  async execute(userId: string) {
    const user = await this.userRepository.findActiveById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const response: AuthUserResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    return buildSingleResponse(response);
  }
}
