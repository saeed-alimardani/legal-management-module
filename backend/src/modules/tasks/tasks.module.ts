import { Module } from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateTaskUseCase } from './application/create-task.use-case';
import { DeleteTaskUseCase } from './application/delete-task.use-case';
import { GetTaskUseCase } from './application/get-task.use-case';
import { ListTasksUseCase } from './application/list-tasks.use-case';
import { UpdateTaskUseCase } from './application/update-task.use-case';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import { TasksController } from './presentation/tasks.controller';

@Module({
  controllers: [TasksController],
  providers: [
    RolesGuard,
    PrismaTaskRepository,
    CreateTaskUseCase,
    ListTasksUseCase,
    GetTaskUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
  ],
  exports: [PrismaTaskRepository],
})
export class TasksModule {}
