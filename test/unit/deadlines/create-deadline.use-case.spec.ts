import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  DeadlineStatus,
  EntityType,
  UserRole,
} from '@prisma/client';
import { CreateDeadlineUseCase } from '../../../src/modules/deadlines/application/create-deadline.use-case';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('CreateDeadlineUseCase', () => {
  let useCase: CreateDeadlineUseCase;
  let deadlineRepository: jest.Mocked<
    Pick<
      PrismaDeadlineRepository,
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

  const dueDate = new Date('2026-07-20T15:30:00.000Z');
  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const createdDeadline = {
    id: 'dl-1',
    title: 'Hearing',
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
    status: DeadlineStatus.PENDING,
    assigneeId: null,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    completedAt: null,
    createdById: counsel.id,
    createdAt,
    updatedAt: createdAt,
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    deadlineRepository = {
      create: jest.fn().mockResolvedValue(createdDeadline),
      findParentOwner: jest.fn().mockResolvedValue({ ownerId: counsel.id }),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateDeadlineUseCase(
      deadlineRepository as unknown as PrismaDeadlineRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      { get: jest.fn().mockReturnValue('Asia/Tehran') } as unknown as ConfigService,
    );
  });

  it('creates deadline on owned case and stores dueDate as UTC midnight', async () => {
    const result = await useCase.execute(counsel, {
      title: 'Hearing',
      dueDate,
      caseId: 'case-1',
    });

    expect(deadlineRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: new Date('2026-07-20T00:00:00.000Z'),
        caseId: 'case-1',
        createdById: counsel.id,
        status: DeadlineStatus.PENDING,
      }),
    );
    expect(result.data.dueDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(result.data.createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.DEADLINE,
        entityId: 'dl-1',
      }),
    );
  });

  it('rejects when no parent FK is provided', async () => {
    await expect(
      useCase.execute(counsel, { title: 'X', dueDate }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when more than one parent FK is provided', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'X',
        dueDate,
        caseId: 'case-1',
        contractId: 'contract-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when parent matter is missing', async () => {
    deadlineRepository.findParentOwner.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, {
        title: 'X',
        dueDate,
        caseId: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects counsel creating on another counsel case', async () => {
    deadlineRepository.findParentOwner.mockResolvedValue({
      ownerId: otherCounsel.id,
    });

    await expect(
      useCase.execute(counsel, {
        title: 'X',
        dueDate,
        caseId: 'case-2',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects viewer create', async () => {
    await expect(
      useCase.execute(viewer, {
        title: 'X',
        dueDate,
        caseId: 'case-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects inactive assignee', async () => {
    deadlineRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(counsel, {
        title: 'X',
        dueDate,
        caseId: 'case-1',
        assigneeId: 'inactive-user',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
