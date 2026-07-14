import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, TaskStatus, UserRole } from '@prisma/client';
import { UpdateTaskUseCase } from '../../../src/modules/tasks/application/update-task.use-case';
import { PrismaTaskRepository } from '../../../src/modules/tasks/infrastructure/prisma-task.repository';
import { TaskWithParent } from '../../../src/modules/tasks/domain/task.types';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('UpdateTaskUseCase', () => {
  let useCase: UpdateTaskUseCase;
  let taskRepository: jest.Mocked<
    Pick<PrismaTaskRepository, 'findById' | 'update' | 'userExistsAndActive'>
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
    const existing = buildTask();

    taskRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation((_id, input) =>
        Promise.resolve(buildTask({ ...input })),
      ),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateTaskUseCase(
      taskRepository as unknown as PrismaTaskRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('logs STATUS_CHANGED when status is changed', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: TaskStatus.TODO }),
    );
    taskRepository.update.mockResolvedValue(
      buildTask({ status: TaskStatus.IN_PROGRESS }),
    );

    await useCase.execute(counsel, 'task-1', {
      status: TaskStatus.IN_PROGRESS,
    });

    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.STATUS_CHANGED,
        entityType: EntityType.TASK,
        entityId: 'task-1',
        metadata: expect.objectContaining({
          from: TaskStatus.TODO,
          to: TaskStatus.IN_PROGRESS,
        }),
      }),
    );
  });

  it('logs UPDATED when only title changes', async () => {
    taskRepository.update.mockResolvedValue(
      buildTask({ title: 'New title' }),
    );

    await useCase.execute(counsel, 'task-1', { title: 'New title' });

    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATED,
        metadata: expect.objectContaining({ fields: ['title'] }),
      }),
    );
  });

  it('sets completedAt when status changes to DONE', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: TaskStatus.IN_PROGRESS }),
    );
    taskRepository.update.mockResolvedValue(
      buildTask({ status: TaskStatus.DONE, completedAt: new Date() }),
    );

    await useCase.execute(counsel, 'task-1', { status: TaskStatus.DONE });

    const updateInput = (taskRepository.update as jest.Mock).mock.calls[0][1];
    expect(updateInput.completedAt).toBeInstanceOf(Date);
  });

  it('clears completedAt when reopening a DONE task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: TaskStatus.DONE, completedAt: createdAt }),
    );
    taskRepository.update.mockResolvedValue(
      buildTask({ status: TaskStatus.TODO, completedAt: null }),
    );

    await useCase.execute(counsel, 'task-1', { status: TaskStatus.TODO });

    const updateInput = (taskRepository.update as jest.Mock).mock.calls[0][1];
    expect(updateInput.completedAt).toBeNull();
  });

  it('does not set completedAt when status does not change to DONE', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: TaskStatus.TODO }),
    );
    taskRepository.update.mockResolvedValue(
      buildTask({ status: TaskStatus.IN_PROGRESS }),
    );

    await useCase.execute(counsel, 'task-1', { status: TaskStatus.IN_PROGRESS });

    const updateInput = (taskRepository.update as jest.Mock).mock.calls[0][1];
    expect(updateInput.completedAt).toBeUndefined();
  });

  it('skips log when no fields actually change (no-op)', async () => {
    const title = 'Review contract';
    taskRepository.findById.mockResolvedValue(buildTask({ title }));
    taskRepository.update.mockResolvedValue(buildTask({ title }));

    await useCase.execute(counsel, 'task-1', { title });

    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('allows the assignee to edit the task', async () => {
    const assigneeCounsel: AuthenticatedUser = {
      id: 'assignee-id',
      email: 'assignee@legal.local',
      fullName: 'Assignee',
      role: UserRole.LEGAL_COUNSEL,
    };
    // Task owner is different from assignee
    taskRepository.findById.mockResolvedValue(
      buildTask({
        assigneeId: assigneeCounsel.id,
        createdById: 'someone-else',
        legalCase: { ownerId: otherCounsel.id, deletedAt: null },
      }),
    );
    taskRepository.update.mockResolvedValue(
      buildTask({ title: 'Updated', assigneeId: assigneeCounsel.id }),
    );

    const result = await useCase.execute(assigneeCounsel, 'task-1', {
      title: 'Updated',
    });

    expect(result.data).toBeDefined();
  });

  it('allows the creator to edit the task even if not owner or assignee', async () => {
    const creator: AuthenticatedUser = {
      id: 'creator-id',
      email: 'creator@legal.local',
      fullName: 'Creator',
      role: UserRole.LEGAL_COUNSEL,
    };
    taskRepository.findById.mockResolvedValue(
      buildTask({
        createdById: creator.id,
        assigneeId: 'someone-else',
        legalCase: { ownerId: otherCounsel.id, deletedAt: null },
      }),
    );
    taskRepository.update.mockResolvedValue(buildTask({ title: 'Updated' }));

    const result = await useCase.execute(creator, 'task-1', {
      title: 'Updated',
    });

    expect(result.data).toBeDefined();
  });

  it('throws 403 when non-assignee, non-owner, non-creator counsel tries to edit', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        legalCase: { ownerId: counsel.id, deletedAt: null },
        assigneeId: 'other-assignee',
        createdById: 'other-creator',
      }),
    );

    await expect(
      useCase.execute(otherCounsel, 'task-1', { title: 'Hack' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when viewer tries to update', async () => {
    await expect(
      useCase.execute(viewer, 'task-1', { title: 'X' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 404 when task does not exist', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing-task', { title: 'X' }),
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
      useCase.execute(counsel, 'task-1', { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 404 when new assignee is inactive or not found', async () => {
    taskRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(counsel, 'task-1', { assigneeId: 'inactive-user' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows admin to update any task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        legalCase: { ownerId: otherCounsel.id, deletedAt: null },
      }),
    );
    taskRepository.update.mockResolvedValue(buildTask({ title: 'Admin edit' }));

    const result = await useCase.execute(admin, 'task-1', {
      title: 'Admin edit',
    });

    expect(result.data).toBeDefined();
  });

  it('allows manager to update any task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        legalCase: { ownerId: counsel.id, deletedAt: null },
      }),
    );
    taskRepository.update.mockResolvedValue(buildTask({ title: 'Manager edit' }));

    const result = await useCase.execute(manager, 'task-1', {
      title: 'Manager edit',
    });

    expect(result.data).toBeDefined();
  });

  it('returns Persian date strings', async () => {
    taskRepository.update.mockResolvedValue(
      buildTask({ dueDate: new Date('2026-07-20T00:00:00.000Z'), title: 'New' }),
    );

    const result = await useCase.execute(counsel, 'task-1', { title: 'New' });

    expect(result.data.createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
    expect(result.data.dueDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});
