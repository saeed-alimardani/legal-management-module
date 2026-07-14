import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../config/constants';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaDeadlineRepository } from '../infrastructure/prisma-deadline.repository';
import {
  resolveParentOwnerId,
  resolveResponseTimeZone,
  toDeadlineResponse,
} from './deadline.helpers';

@Injectable()
export class GetDeadlineUseCase {
  constructor(
    private readonly deadlineRepository: PrismaDeadlineRepository,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser, deadlineId: string) {
    const deadline = await this.deadlineRepository.findById(deadlineId);

    if (!deadline) {
      throw new NotFoundException('Deadline not found');
    }

    const parentOwnerId = resolveParentOwnerId(deadline);

    if (!parentOwnerId) {
      throw new NotFoundException('Deadline not found');
    }

    this.accessControl.assertCanView(user, {
      ownerId: parentOwnerId,
      assigneeId: deadline.assigneeId,
    });

    const timeZone = resolveResponseTimeZone(
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE),
    );

    return buildSingleResponse(toDeadlineResponse(deadline, timeZone));
  }
}
