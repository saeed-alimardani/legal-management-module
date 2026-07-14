import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, ContractStatus, EntityType } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { toUtcDateOnly } from '../../../shared/utils/date-boundary.util';
import { isValidContractDateRange } from '../domain/contract-date.rules';
import { CreateContractInput } from '../domain/contract.types';
import { PrismaContractRepository } from '../infrastructure/prisma-contract.repository';

export interface CreateContractCommand {
  title: string;
  type: CreateContractInput['type'];
  status?: ContractStatus;
  ownerId?: string;
  counterpartyName: string;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  renewalDate?: Date | null;
  keyTerms?: string | null;
}

@Injectable()
export class CreateContractUseCase {
  constructor(
    private readonly contractRepository: PrismaContractRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateContractCommand) {
    this.accessControl.assertCanMutate(user);

    const effectiveDate = command.effectiveDate
      ? toUtcDateOnly(command.effectiveDate)
      : null;
    const expirationDate = command.expirationDate
      ? toUtcDateOnly(command.expirationDate)
      : null;
    const renewalDate = command.renewalDate
      ? toUtcDateOnly(command.renewalDate)
      : null;

    if (!isValidContractDateRange(effectiveDate, expirationDate)) {
      throw new BadRequestException(
        'expirationDate must be on or after effectiveDate',
      );
    }

    const ownerId = await this.resolveOwnerId(user, command.ownerId);
    const referenceCode =
      await this.contractRepository.generateNextReferenceCode();

    const contract = await this.contractRepository.create({
      referenceCode,
      title: command.title,
      type: command.type,
      status: command.status ?? ContractStatus.DRAFT,
      ownerId,
      counterpartyName: command.counterpartyName,
      effectiveDate,
      expirationDate,
      renewalDate,
      keyTerms: command.keyTerms,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.CONTRACT,
      entityId: contract.id,
      metadata: {
        referenceCode: contract.referenceCode,
        title: contract.title,
        counterpartyName: contract.counterpartyName,
      },
    });

    return buildSingleResponse(contract);
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
      await this.contractRepository.userExistsAndActive(requestedOwnerId);

    if (!ownerExists) {
      throw new NotFoundException('Owner user not found or inactive');
    }

    return requestedOwnerId;
  }
}
