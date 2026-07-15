import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  DeadlineStatus,
  EntityType,
  UserRole,
} from '@prisma/client';
import { UpdateDeadlineUseCase } from '../../../src/modules/deadlines/application/update-deadline.use-case';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('UpdateDeadlineUseCase', () => {
  let useCase: UpdateDeadlineUseCase;
  let deadlineRepository: jest.Mocked<
    Pick<
      PrismaDeadlineRepository,
      'findById' | 'update' | 'userExistsAndActive'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

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

  const existing = {
    id: 'dl-1',
    title: 'Hearing',
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
    status: DeadlineStatus.PENDING,
    assigneeId: assignee.id,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    completedAt: null as Date | null,
    createdById: counsel.id,
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    updatedAt: new Date('2026-07-14T10:00:00.000Z'),
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    deadlineRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(async (_id, input) => ({
        ...existing,
        ...input,
        updatedAt: new Date('2026-07-14T12:00:00.000Z'),
      })),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateDeadlineUseCase(
      deadlineRepository as unknown as PrismaDeadlineRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('allows manager to update title', async () => {
    const result = await useCase.execute(manager, 'dl-1', {
      title: 'Updated Hearing',
    });

    expect(deadlineRepository.update).toHaveBeenCalledWith(
      'dl-1',
      expect.objectContaining({ title: 'Updated Hearing' }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATED,
        entityType: EntityType.DEADLINE,
      }),
    );
    expect(result.data.title).toBe('Updated Hearing');
  });

  it('allows counsel creator to update own deadline', async () => {
    const result = await useCase.execute(counsel, 'dl-1', {
      title: 'Updated by creator',
    });

    expect(result.data.title).toBe('Updated by creator');
  });

  it('rejects counsel assignee from updating', async () => {
    await expect(
      useCase.execute(assignee, 'dl-1', { title: 'By Assignee' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('completing sets completedAt and logs DEADLINE_COMPLETED', async () => {
    await useCase.execute(manager, 'dl-1', {
      status: DeadlineStatus.COMPLETED,
    });

    expect(deadlineRepository.update).toHaveBeenCalledWith(
      'dl-1',
      expect.objectContaining({
        status: DeadlineStatus.COMPLETED,
        completedAt: expect.any(Date),
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DEADLINE_COMPLETED,
      }),
    );
  });

  it('normalizes dueDate to UTC midnight on update', async () => {
    await useCase.execute(manager, 'dl-1', {
      dueDate: new Date('2026-08-01T18:45:00.000Z'),
    });

    expect(deadlineRepository.update).toHaveBeenCalledWith(
      'dl-1',
      expect.objectContaining({
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
      }),
    );
  });

  it('rejects unrelated counsel', async () => {
    const stranger: AuthenticatedUser = {
      id: 'stranger',
      email: 's@legal.local',
      fullName: 'Stranger',
      role: UserRole.LEGAL_COUNSEL,
    };

    await expect(
      useCase.execute(stranger, 'dl-1', { title: 'Nope' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when deadline missing', async () => {
    deadlineRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(manager, 'missing', { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('skips activity log when nothing changed', async () => {
    await useCase.execute(manager, 'dl-1', { title: existing.title });

    expect(activityLogService.log).not.toHaveBeenCalled();
  });
});
