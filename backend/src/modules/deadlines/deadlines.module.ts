import { Module, forwardRef } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { RemindersModule } from '../reminders/reminders.module';
import { CreateDeadlineUseCase } from './application/create-deadline.use-case';
import { DeleteDeadlineUseCase } from './application/delete-deadline.use-case';
import { GetDeadlineUseCase } from './application/get-deadline.use-case';
import { ListDeadlinesUseCase } from './application/list-deadlines.use-case';
import { UpdateDeadlineUseCase } from './application/update-deadline.use-case';
import { PrismaDeadlineRepository } from './infrastructure/prisma-deadline.repository';
import { DeadlinesController } from './presentation/deadlines.controller';

@Module({
  imports: [forwardRef(() => RemindersModule)],
  controllers: [DeadlinesController],
  providers: [
    RolesGuard,
    PrismaDeadlineRepository,
    CreateDeadlineUseCase,
    ListDeadlinesUseCase,
    GetDeadlineUseCase,
    UpdateDeadlineUseCase,
    DeleteDeadlineUseCase,
  ],
  exports: [PrismaDeadlineRepository],
})
export class DeadlinesModule {}
