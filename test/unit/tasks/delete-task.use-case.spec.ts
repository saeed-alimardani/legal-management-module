import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, TaskStatus, UserRole } from '@prisma/client';
import { DeleteTaskUseCase } from '../../../src/modules/tasks/application/delete-task.use-case';
import { PrismaTaskRepository } from '../../../src/modules/tasks/infrastructure/prisma-task.repository';
import { TaskWithParent } from '../../../src/modules/tasks/domain/task.types';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DeleteTaskUseCase', () => {
  let useCase: DeleteTaskUseCase;
  let taskRepository: jest.Mocked<
    Pick<PrismaTaskRepository, 'findById' | 'softDelete'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'other-counsel-id',
    email: 'counsel2@legal.local',
    fullName: 'Other Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const buildTask = (overrides: Partial<TaskWithParent> = {}): TaskWithParent => ({
    id: 'task-1',
    title: 'Review contract',
    description: null,
    status: TaskStatus.TODO,
    assigneeId: 'assignee-id',
    dueDate: null,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    createdById: counsel.id,
    completedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
    ...overrides,
  });

  beforeEach(() => {
    taskRepository = {
      findById: jest.fn().mockResolvedValue(buildTask()),
      softDelete: jest.fn().mockResolvedValue(buildTask({ deletedAt: new Date() })),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteTaskUseCase(
      taskRepository as unknown as PrismaTaskRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('allows creator to soft-delete and logs DELETED with previousStatus', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: TaskStatus.IN_PROGRESS, createdById: counsel.id }),
    );

    const result = await useCase.execute(counsel, 'task-1');

    expect(taskRepository.softDelete).toHaveBeenCalledWith('task-1');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETED,
        entityType: EntityType.TASK,
        entityId: 'task-1',
        actorId: counsel.id,
        metadata: expect.objectContaining({
          previousStatus: TaskStatus.IN_PROGRESS,
          title: 'Review contract',
        }),
      }),
    );
    expect(result.data).toEqual({ success: true });
  });

  it('allows admin to soft-delete any task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ createdById: counsel.id }),
    );

    const result = await useCase.execute(admin, 'task-1');

    expect(taskRepository.softDelete).toHaveBeenCalledWith('task-1');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.DELETED }),
    );
    expect(result.data).toEqual({ success: true });
  });

  it('allows manager to soft-delete any task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ createdById: counsel.id }),
    );

    const result = await useCase.execute(manager, 'task-1');

    expect(taskRepository.softDelete).toHaveBeenCalledWith('task-1');
    expect(result.data).toEqual({ success: true });
  });

  it('throws 403 when assignee who is NOT creator tries to delete', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        assigneeId: otherCounsel.id,
        createdById: counsel.id,
      }),
    );

    await expect(
      useCase.execute(otherCounsel, 'task-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when viewer tries to delete', async () => {
    await expect(
      useCase.execute(viewer, 'task-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 404 when task does not exist', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing-task'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 404 when task parent is deleted', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        legalCase: { ownerId: counsel.id, deletedAt: new Date() },
        contract: null,
        notice: null,
      }),
    );

    await expect(
      useCase.execute(counsel, 'task-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('logs DELETED with previousStatus from existing task regardless of soft-delete result', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: TaskStatus.DONE }),
    );

    await useCase.execute(counsel, 'task-1');

    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ previousStatus: TaskStatus.DONE }),
      }),
    );
  });
});
