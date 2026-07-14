import { Module, forwardRef } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { DeadlinesModule } from '../deadlines/deadlines.module';
import { CreateReminderUseCase } from './application/create-reminder.use-case';
import { GetReminderUseCase } from './application/get-reminder.use-case';
import { ListRemindersUseCase } from './application/list-reminders.use-case';
import { ProcessDueRemindersUseCase } from './application/process-due-reminders.use-case';
import { UpdateReminderUseCase } from './application/update-reminder.use-case';
import { PrismaReminderRepository } from './infrastructure/prisma-reminder.repository';
import { RemindersController } from './presentation/reminders.controller';

@Module({
  imports: [forwardRef(() => DeadlinesModule)],
  controllers: [RemindersController],
  providers: [
    RolesGuard,
    PrismaReminderRepository,
    CreateReminderUseCase,
    ListRemindersUseCase,
    GetReminderUseCase,
    UpdateReminderUseCase,
    ProcessDueRemindersUseCase,
  ],
  exports: [PrismaReminderRepository],
})
export class RemindersModule {}
