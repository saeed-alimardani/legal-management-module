import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EntityType, TaskStatus, UserRole } from '@prisma/client';
import { CreateTaskUseCase } from '../../../src/modules/tasks/application/create-task.use-case';
import { PrismaTaskRepository } from '../../../src/modules/tasks/infrastructure/prisma-task.repository';
import { TaskWithParent } from '../../../src/modules/tasks/domain/task.types';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('CreateTaskUseCase', () => {
  let useCase: CreateTaskUseCase;
  let taskRepository: jest.Mocked<
    Pick<
      PrismaTaskRepository,
      'create' | 'findParentOwner' | 'userExistsAndActive'
    >
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

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const buildTask = (overrides: Partial<TaskWithParent> = {}): TaskWithParent => ({
    id: 'task-1',
    title: 'Review contract',
    description: null,
    status: TaskStatus.TODO,
    assigneeId: counsel.id,
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
      create: jest.fn().mockResolvedValue(buildTask()),
      findParentOwner: jest.fn().mockResolvedValue({ ownerId: counsel.id }),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateTaskUseCase(
      taskRepository as unknown as PrismaTaskRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('creates a task on an owned case and logs CREATED', async () => {
    const result = await useCase.execute(counsel, {
      title: 'Review contract',
      assigneeId: counsel.id,
      caseId: 'case-1',
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Review contract',
        caseId: 'case-1',
        createdById: counsel.id,
        status: TaskStatus.TODO,
        assigneeId: counsel.id,
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.TASK,
        entityId: 'task-1',
        actorId: counsel.id,
      }),
    );
    expect(result.data).toBeDefined();
  });

  it('returns Persian date strings in the response', async () => {
    taskRepository.create.mockResolvedValue(
      buildTask({ dueDate: new Date('2026-07-20T00:00:00.000Z') }),
    );

    const result = await useCase.execute(counsel, {
      title: 'Review contract',
      assigneeId: counsel.id,
      caseId: 'case-1',
      dueDate: new Date('2026-07-20T15:30:00.000Z'),
    });

    expect(result.data.dueDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(result.data.createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('defaults status to TODO when not provided', async () => {
    await useCase.execute(counsel, {
      title: 'Review contract',
      assigneeId: counsel.id,
      caseId: 'case-1',
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: TaskStatus.TODO }),
    );
  });

  it('uses provided status when supplied', async () => {
    taskRepository.create.mockResolvedValue(
      buildTask({ status: TaskStatus.IN_PROGRESS }),
    );

    await useCase.execute(counsel, {
      title: 'Review',
      assigneeId: counsel.id,
      caseId: 'case-1',
      status: TaskStatus.IN_PROGRESS,
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: TaskStatus.IN_PROGRESS }),
    );
  });

  it('throws 400 when no parent FK is provided', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'X',
        assigneeId: counsel.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when more than one parent FK is provided', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'X',
        assigneeId: counsel.id,
        caseId: 'case-1',
        contractId: 'contract-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 400 when all three parent FKs are provided', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'X',
        assigneeId: counsel.id,
        caseId: 'case-1',
        contractId: 'contract-1',
        noticeId: 'notice-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws 404 when parent matter is not found', async () => {
    taskRepository.findParentOwner.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, {
        title: 'X',
        assigneeId: counsel.id,
        caseId: 'missing-case',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 403 when counsel creates on another counsel case', async () => {
    taskRepository.findParentOwner.mockResolvedValue({
      ownerId: otherCounsel.id,
    });

    await expect(
      useCase.execute(counsel, {
        title: 'X',
        assigneeId: counsel.id,
        caseId: 'case-2',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when viewer tries to create', async () => {
    await expect(
      useCase.execute(viewer, {
        title: 'X',
        assigneeId: viewer.id,
        caseId: 'case-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 404 when assignee is inactive or not found', async () => {
    taskRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(counsel, {
        title: 'X',
        assigneeId: 'inactive-user',
        caseId: 'case-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows manager to create on any case (not owned by manager)', async () => {
    taskRepository.findParentOwner.mockResolvedValue({
      ownerId: counsel.id,
    });
    taskRepository.create.mockResolvedValue(
      buildTask({ createdById: manager.id }),
    );

    const result = await useCase.execute(manager, {
      title: 'Manager task',
      assigneeId: counsel.id,
      caseId: 'case-1',
    });

    expect(result.data).toBeDefined();
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CREATED }),
    );
  });

  it('creates task with contractId parent', async () => {
    taskRepository.findParentOwner.mockResolvedValue({ ownerId: counsel.id });
    taskRepository.create.mockResolvedValue(
      buildTask({
        caseId: null,
        contractId: 'contract-1',
        legalCase: null,
        contract: { ownerId: counsel.id, deletedAt: null },
      }),
    );

    const result = await useCase.execute(counsel, {
      title: 'Contract task',
      assigneeId: counsel.id,
      contractId: 'contract-1',
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: 'contract-1', caseId: undefined }),
    );
    expect(result.data).toBeDefined();
  });

  it('creates task with noticeId parent', async () => {
    taskRepository.findParentOwner.mockResolvedValue({ ownerId: counsel.id });
    taskRepository.create.mockResolvedValue(
      buildTask({
        caseId: null,
        noticeId: 'notice-1',
        legalCase: null,
        notice: { ownerId: counsel.id, deletedAt: null },
      }),
    );

    const result = await useCase.execute(counsel, {
      title: 'Notice task',
      assigneeId: counsel.id,
      noticeId: 'notice-1',
    });

    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ noticeId: 'notice-1', caseId: undefined }),
    );
    expect(result.data).toBeDefined();
  });

  it('converts dueDate to UTC midnight', async () => {
    const dueDate = new Date('2026-07-20T15:30:00.000Z');
    taskRepository.create.mockResolvedValue(
      buildTask({ dueDate: new Date('2026-07-20T00:00:00.000Z') }),
    );

    await useCase.execute(counsel, {
      title: 'X',
      assigneeId: counsel.id,
      caseId: 'case-1',
      dueDate,
    });

    const callArg = (taskRepository.create as jest.Mock).mock.calls[0][0];
    expect(callArg.dueDate).toEqual(new Date('2026-07-20T00:00:00.000Z'));
  });

  it('stores null dueDate when not provided', async () => {
    await useCase.execute(counsel, {
      title: 'X',
      assigneeId: counsel.id,
      caseId: 'case-1',
    });

    const callArg = (taskRepository.create as jest.Mock).mock.calls[0][0];
    expect(callArg.dueDate).toBeNull();
  });
});
