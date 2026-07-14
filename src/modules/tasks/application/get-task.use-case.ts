import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaTaskRepository } from '../infrastructure/prisma-task.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toTaskResponse,
} from './task.helpers';

@Injectable()
export class GetTaskUseCase {
  constructor(
    private readonly taskRepository: PrismaTaskRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, taskId: string) {
    const task = await this.taskRepository.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const parentOwnerId = resolveParentOwnerId(task);

    if (!parentOwnerId) {
      throw new NotFoundException('Task not found');
    }

    this.accessControl.assertCanView(user, {
      ownerId: parentOwnerId,
      assigneeId: task.assigneeId,
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toTaskResponse(task, timeZone));
  }
}
