import { ConfigService } from '@nestjs/config';
import { TaskStatus, UserRole } from '@prisma/client';
import { ListTasksUseCase } from '../../../src/modules/tasks/application/list-tasks.use-case';
import { PrismaTaskRepository } from '../../../src/modules/tasks/infrastructure/prisma-task.repository';
import { TaskWithParent } from '../../../src/modules/tasks/domain/task.types';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListTasksUseCase', () => {
  let useCase: ListTasksUseCase;
  let taskRepository: jest.Mocked<Pick<PrismaTaskRepository, 'list'>>;
  let accessControl: AccessControlService;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
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

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
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

  const emptyResult = { items: [], total: 0 };

  beforeEach(() => {
    taskRepository = {
      list: jest.fn().mockResolvedValue(emptyResult),
    };

    accessControl = new AccessControlService();

    useCase = new ListTasksUseCase(
      taskRepository as unknown as PrismaTaskRepository,
      accessControl,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('passes counselUserId scope when user is LEGAL_COUNSEL', async () => {
    await useCase.execute(counsel, { page: 1, limit: 10 });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.any(Object),
      { counselUserId: counsel.id },
    );
  });

  it('passes empty scope when user is manager', async () => {
    await useCase.execute(manager, { page: 1, limit: 10 });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.any(Object),
      {},
    );
  });

  it('passes empty scope when user is admin', async () => {
    await useCase.execute(admin, { page: 1, limit: 10 });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.any(Object),
      {},
    );
  });

  it('passes empty scope when user is viewer', async () => {
    await useCase.execute(viewer, { page: 1, limit: 10 });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.any(Object),
      {},
    );
  });

  it('forwards all filter fields to the repository', async () => {
    await useCase.execute(counsel, {
      assigneeId: 'user-1',
      status: TaskStatus.IN_PROGRESS,
      caseId: 'case-1',
      page: 2,
      limit: 5,
    });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeId: 'user-1',
        status: TaskStatus.IN_PROGRESS,
        caseId: 'case-1',
        page: 2,
        limit: 5,
      }),
      expect.any(Object),
    );
  });

  it('maps items through toTaskResponse with Persian dates', async () => {
    const task = buildTask({ dueDate: new Date('2026-07-20T00:00:00.000Z') });
    taskRepository.list.mockResolvedValue({ items: [task], total: 1 });

    const result = await useCase.execute(counsel, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].dueDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(result.data[0].createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('returns correct pagination metadata', async () => {
    taskRepository.list.mockResolvedValue({
      items: [buildTask(), buildTask({ id: 'task-2' })],
      total: 25,
    });

    const result = await useCase.execute(counsel, { page: 2, limit: 2 });

    expect(result.meta.total).toBe(25);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it('returns empty data when repository returns no items', async () => {
    taskRepository.list.mockResolvedValue({ items: [], total: 0 });

    const result = await useCase.execute(counsel, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  it('forwards contractId filter', async () => {
    await useCase.execute(counsel, {
      contractId: 'contract-1',
      page: 1,
      limit: 10,
    });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: 'contract-1' }),
      expect.any(Object),
    );
  });

  it('forwards noticeId filter', async () => {
    await useCase.execute(counsel, {
      noticeId: 'notice-1',
      page: 1,
      limit: 10,
    });

    expect(taskRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ noticeId: 'notice-1' }),
      expect.any(Object),
    );
  });
});
