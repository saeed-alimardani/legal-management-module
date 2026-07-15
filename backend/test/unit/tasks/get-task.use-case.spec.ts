import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TaskStatus, UserRole } from '@prisma/client';
import { GetTaskUseCase } from '../../../src/modules/tasks/application/get-task.use-case';
import { PrismaTaskRepository } from '../../../src/modules/tasks/infrastructure/prisma-task.repository';
import { TaskWithParent } from '../../../src/modules/tasks/domain/task.types';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetTaskUseCase', () => {
  let useCase: GetTaskUseCase;
  let taskRepository: jest.Mocked<Pick<PrismaTaskRepository, 'findById'>>;

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

  const buildTask = (
    overrides: Partial<TaskWithParent> = {},
  ): TaskWithParent => ({
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
    };

    useCase = new GetTaskUseCase(
      taskRepository as unknown as PrismaTaskRepository,
      new AccessControlService(),
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('returns the task when counsel is the parent owner', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ legalCase: { ownerId: counsel.id, deletedAt: null } }),
    );

    const result = await useCase.execute(counsel, 'task-1');

    expect(result.data.id).toBe('task-1');
    expect(result.data.createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('returns the task when counsel is the assignee', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        assigneeId: otherCounsel.id,
        legalCase: { ownerId: counsel.id, deletedAt: null },
      }),
    );

    const result = await useCase.execute(otherCounsel, 'task-1');

    expect(result.data.id).toBe('task-1');
  });

  it('throws 403 when another counsel is neither owner nor assignee', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        assigneeId: 'third-party',
        legalCase: { ownerId: counsel.id, deletedAt: null },
      }),
    );

    await expect(useCase.execute(otherCounsel, 'task-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws 404 when task does not exist', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing-task')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 404 when task parent is deleted', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        legalCase: { ownerId: counsel.id, deletedAt: new Date() },
        contract: null,
        notice: null,
      }),
    );

    await expect(useCase.execute(counsel, 'task-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('denies viewer access to unrelated task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ legalCase: { ownerId: counsel.id, deletedAt: null } }),
    );

    await expect(useCase.execute(viewer, 'task-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows viewer to view task when assignee', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        assigneeId: viewer.id,
        legalCase: { ownerId: counsel.id, deletedAt: null },
      }),
    );

    const result = await useCase.execute(viewer, 'task-1');

    expect(result.data.id).toBe('task-1');
  });

  it('allows manager to view any task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ legalCase: { ownerId: otherCounsel.id, deletedAt: null } }),
    );

    const result = await useCase.execute(manager, 'task-1');

    expect(result.data.id).toBe('task-1');
  });

  it('allows admin to view any task', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ legalCase: { ownerId: otherCounsel.id, deletedAt: null } }),
    );

    const result = await useCase.execute(admin, 'task-1');

    expect(result.data.id).toBe('task-1');
  });

  it('returns Persian date strings for dueDate', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ dueDate: new Date('2026-07-20T00:00:00.000Z') }),
    );

    const result = await useCase.execute(counsel, 'task-1');

    expect(result.data.dueDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('returns null dueDatePersian when dueDate is null', async () => {
    const result = await useCase.execute(counsel, 'task-1');

    expect(result.data.dueDatePersian).toBeNull();
  });

  it('resolves parent from contract when legalCase is null', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        caseId: null,
        contractId: 'contract-1',
        legalCase: null,
        contract: { ownerId: counsel.id, deletedAt: null },
        notice: null,
      }),
    );

    const result = await useCase.execute(counsel, 'task-1');

    expect(result.data.contractId).toBe('contract-1');
  });

  it('resolves parent from notice when legalCase and contract are null', async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({
        caseId: null,
        noticeId: 'notice-1',
        legalCase: null,
        contract: null,
        notice: { ownerId: counsel.id, deletedAt: null },
      }),
    );

    const result = await useCase.execute(counsel, 'task-1');

    expect(result.data.noticeId).toBe('notice-1');
  });
});
