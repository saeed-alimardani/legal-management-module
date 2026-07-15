import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { ActivityLogService } from '../../../shared/activity-log/activity-log.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';

export interface CreateUserCommand {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: PrismaUserRepository,
    private readonly accessControl: AccessControlService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async execute(user: AuthenticatedUser, command: CreateUserCommand) {
    this.accessControl.assertCanManageUsers(user);

    const existing = await this.userRepository.findByEmail(command.email);

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(command.password, 10);

    const created = await this.userRepository.create({
      email: command.email,
      passwordHash,
      fullName: command.fullName,
      role: command.role,
    });

    await this.activityLogService.log({
      actorId: user.id,
      action: AuditAction.CREATED,
      entityType: EntityType.USER,
      entityId: created.id,
      metadata: {
        email: created.email,
        fullName: created.fullName,
        role: created.role,
      },
    });

    return buildSingleResponse(created);
  }
}
