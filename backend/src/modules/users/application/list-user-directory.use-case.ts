import { Injectable } from '@nestjs/common';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

@Injectable()
export class ListUserDirectoryUseCase {
  constructor(private readonly userRepository: PrismaUserRepository) {}

  async execute() {
    const items = await this.userRepository.listDirectory();
    return buildSingleResponse(items);
  }
}
