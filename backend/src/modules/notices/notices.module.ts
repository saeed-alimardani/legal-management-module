import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateNoticeUseCase } from './application/create-notice.use-case';
import { DeleteNoticeUseCase } from './application/delete-notice.use-case';
import { GetNoticeUseCase } from './application/get-notice.use-case';
import { ListNoticesUseCase } from './application/list-notices.use-case';
import { ReassignNoticeUseCase } from './application/reassign-notice.use-case';
import { UpdateNoticeUseCase } from './application/update-notice.use-case';
import { PrismaNoticeRepository } from './infrastructure/prisma-notice.repository';
import { NoticesController } from './presentation/notices.controller';

@Module({
  controllers: [NoticesController],
  providers: [
    RolesGuard,
    PrismaNoticeRepository,
    CreateNoticeUseCase,
    ListNoticesUseCase,
    GetNoticeUseCase,
    UpdateNoticeUseCase,
    DeleteNoticeUseCase,
    ReassignNoticeUseCase,
  ],
  exports: [PrismaNoticeRepository],
})
export class NoticesModule {}
