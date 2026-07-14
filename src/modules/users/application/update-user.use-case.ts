import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

export interface UpdateUserCommand {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(
    user: AuthenticatedUser,
    userId: string,
    command: UpdateUserCommand,
  ) {
    this.assertAdminOrManager(user);
    this.accessControl.assertCanMutate(user);

    const existing = await this.userRepository.findById(userId);

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const changedFields = this.getChangedFields(existing, command);

    if (changedFields.length === 0) {
      return buildSingleResponse(existing);
    }

    const updated = await this.userRepository.update(userId, {
      ...(command.fullName !== undefined ? { fullName: command.fullName } : {}),
      ...(command.role !== undefined ? { role: command.role } : {}),
      ...(command.isActive !== undefined ? { isActive: command.isActive } : {}),
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.USER,
      entityId: updated.id,
      metadata: { fields: changedFields },
    });

    return buildSingleResponse(updated);
  }

  private getChangedFields(
    existing: {
      fullName: string;
      role: UserRole;
      isActive: boolean;
    },
    command: UpdateUserCommand,
  ): string[] {
    const changed: string[] = [];

    if (
      command.fullName !== undefined &&
      command.fullName !== existing.fullName
    ) {
      changed.push('fullName');
    }

    if (command.role !== undefined && command.role !== existing.role) {
      changed.push('role');
    }

    if (
      command.isActive !== undefined &&
      command.isActive !== existing.isActive
    ) {
      changed.push('isActive');
    }

    return changed;
  }

  private assertAdminOrManager(user: AuthenticatedUser): void {
    if (!this.accessControl.isAdminOrManager(user)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
