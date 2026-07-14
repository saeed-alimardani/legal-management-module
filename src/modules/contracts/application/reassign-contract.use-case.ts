import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';
import {
  getContractResponseTimeZone,
  toContractResponse,
} from './contract.helpers';

@Injectable()
export class ReassignContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    contractId: string,
    newOwnerId: string,
  ) {
    this.accessControl.assertCanReassign(user);

    const existing = await this.contractRepository.findById(contractId);

    if (!existing) {
      throw new NotFoundException('Contract not found');
    }

    const timeZone = getContractResponseTimeZone(this.configService);

    if (existing.ownerId === newOwnerId) {
      return buildSingleResponse(toContractResponse(existing, timeZone));
    }

    const ownerExists =
      await this.contractRepository.userExistsAndActive(newOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('New owner user not found or inactive');
    }

    const updated = await this.contractRepository.reassign(
      contractId,
      newOwnerId,
    );

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.CONTRACT,
      entityId: updated.id,
      metadata: {
        fromUserId: existing.ownerId,
        toUserId: newOwnerId,
      },
    });

    return buildSingleResponse(toContractResponse(updated, timeZone));
  }
}
