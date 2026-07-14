import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateDiscussionUseCase } from './application/create-discussion.use-case';
import { DeleteDiscussionUseCase } from './application/delete-discussion.use-case';
import { GetDiscussionUseCase } from './application/get-discussion.use-case';
import { ListDiscussionsUseCase } from './application/list-discussions.use-case';
import { UpdateDiscussionUseCase } from './application/update-discussion.use-case';
import { PrismaDiscussionRepository } from './infrastructure/prisma-discussion.repository';
import { DiscussionsController } from './presentation/discussions.controller';

@Module({
  controllers: [DiscussionsController],
  providers: [
    RolesGuard,
    PrismaDiscussionRepository,
    CreateDiscussionUseCase,
    ListDiscussionsUseCase,
    GetDiscussionUseCase,
    UpdateDiscussionUseCase,
    DeleteDiscussionUseCase,
  ],
  exports: [PrismaDiscussionRepository],
})
export class DiscussionsModule {}
