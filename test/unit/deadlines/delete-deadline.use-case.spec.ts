import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DeadlineStatus,
  EntityType,
  UserRole,
} from '@prisma/client';
import { DeleteDeadlineUseCase } from '../../../src/modules/deadlines/application/delete-deadline.use-case';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DeleteDeadlineUseCase', () => {
  let useCase: DeleteDeadlineUseCase;
  let deadlineRepository: jest.Mocked<
    Pick<PrismaDeadlineRepository, 'findById' | 'cancel'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const assignee: AuthenticatedUser = {
    id: 'assignee-id',
    email: 'assignee@legal.local',
    fullName: 'Assignee',
    role: UserRole.LEGAL_COUNSEL,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const existing = {
    id: 'dl-1',
    title: 'Hearing',
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
    status: DeadlineStatus.PENDING,
    assigneeId: assignee.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    completedAt: null,
    createdById: counsel.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    deadlineRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      cancel: jest.fn().mockResolvedValue({
        ...existing,
        status: DeadlineStatus.CANCELLED,
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteDeadlineUseCase(
      deadlineRepository as unknown as PrismaDeadlineRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('cancels deadline for parent owner and logs DELETED', async () => {
    const result = await useCase.execute(counsel, 'dl-1');

    expect(deadlineRepository.cancel).toHaveBeenCalledWith('dl-1');
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.DELETED,
      entityType: EntityType.DEADLINE,
      entityId: 'dl-1',
      metadata: expect.objectContaining({
        title: 'Hearing',
        previousStatus: DeadlineStatus.PENDING,
      }),
    });
    expect(result.data).toEqual({ success: true });
  });

  it('allows manager to cancel any deadline', async () => {
    await expect(useCase.execute(manager, 'dl-1')).resolves.toEqual({
      data: { success: true },
    });
  });

  it('denies assignee-only cancel (parent owner required)', async () => {
    await expect(useCase.execute(assignee, 'dl-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when deadline missing', async () => {
    deadlineRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
