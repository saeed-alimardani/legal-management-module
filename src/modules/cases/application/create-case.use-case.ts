import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, CaseStatus, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { CreateCaseInput } from '../domain/case.types';
import { PrismaCaseRepository } from '../infrastructure/prisma-case.repository';

export interface CreateCaseCommand {
  title: string;
  type: CreateCaseInput['type'];
  status?: CaseStatus;
  priority: CreateCaseInput['priority'];
  ownerId?: string;
  description?: string | null;
  openedDate?: Date | null;
  closedDate?: Date | null;
  parties?: CreateCaseInput['parties'];
}

@Injectable()
export class CreateCaseUseCase {
  constructor(
    private readonly caseRepository: PrismaCaseRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateCaseCommand) {
    this.accessControl.assertCanMutate(user);

    const ownerId = await this.resolveOwnerId(user, command.ownerId);
    const referenceCode = await this.caseRepository.generateNextReferenceCode();

    const legalCase = await this.caseRepository.create({
      referenceCode,
      title: command.title,
      type: command.type,
      status: command.status ?? CaseStatus.OPEN,
      priority: command.priority,
      ownerId,
      description: command.description,
      openedDate: command.openedDate,
      closedDate: command.closedDate,
      parties: command.parties,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.CASE,
      entityId: legalCase.id,
      metadata: {
        referenceCode: legalCase.referenceCode,
        title: legalCase.title,
        partyCount: legalCase.parties?.length ?? 0,
      },
    });

    return buildSingleResponse(legalCase);
  }

  private async resolveOwnerId(
    user: AuthenticatedUser,
    requestedOwnerId?: string,
  ): Promise<string> {
    if (!requestedOwnerId || requestedOwnerId === user.id) {
      return user.id;
    }

    if (!this.accessControl.isAdminOrManager(user)) {
      throw new BadRequestException(
        'Only admins and managers can assign a different owner',
      );
    }

    const ownerExists =
      await this.caseRepository.userExistsAndActive(requestedOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('Owner user not found or inactive');
    }

    return requestedOwnerId;
  }
}
