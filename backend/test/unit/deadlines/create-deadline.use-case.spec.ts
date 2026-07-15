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
import { PrismaReminderRepository } from '../../../src/modules/reminders/infrastructure/prisma-reminder.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { MatterInvolvementService } from '../../../src/shared/access-control/matter-involvement.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';
import { createMockMatterInvolvement } from '../../helpers/rbac.helper';

describe('CreateDeadlineUseCase', () => {
  let useCase: CreateDeadlineUseCase;
  let deadlineRepository: jest.Mocked<
    Pick<
      PrismaDeadlineRepository,
      'create' | 'findParentOwner' | 'userExistsAndActive'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;
  let reminderRepository: jest.Mocked<Pick<PrismaReminderRepository, 'create'>>;
  let matterInvolvement: jest.Mocked<
    Pick<MatterInvolvementService, 'isUserInvolvedInParent'>
  >;

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
    createdById: manager.id,
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

    reminderRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'rem-1',
        deadlineId: 'dl-1',
        remindAt: new Date('2026-07-19T05:30:00.000Z'),
        status: 'PENDING',
        message: null,
        sentAt: null,
        createdById: manager.id,
        createdAt,
        updatedAt: createdAt,
        deadline: createdDeadline,
      }),
    };

    matterInvolvement = createMockMatterInvolvement();

    useCase = new CreateDeadlineUseCase(
      deadlineRepository as unknown as PrismaDeadlineRepository,
      reminderRepository as unknown as PrismaReminderRepository,
      new AccessControlService(),
      matterInvolvement as unknown as MatterInvolvementService,
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('creates deadline on owned case and stores dueDate as UTC midnight', async () => {
    const result = await useCase.execute(manager, {
      title: 'Hearing',
      dueDate,
      caseId: 'case-1',
    });

    expect(deadlineRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dueDate: new Date('2026-07-20T00:00:00.000Z'),
        caseId: 'case-1',
        createdById: manager.id,
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
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deadlineId: 'dl-1',
        createdById: manager.id,
      }),
    );
  });

  it('rejects when no parent FK is provided', async () => {
    await expect(
      useCase.execute(manager, { title: 'X', dueDate }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when more than one parent FK is provided', async () => {
    await expect(
      useCase.execute(manager, {
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
      useCase.execute(manager, {
        title: 'X',
        dueDate,
        caseId: 'missing',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows counsel to create deadline on own matter', async () => {
    deadlineRepository.findParentOwner.mockResolvedValue({
      ownerId: counsel.id,
    });

    const result = await useCase.execute(counsel, {
      title: 'Prepare filing',
      dueDate,
      caseId: 'case-1',
    });

    expect(result.data.title).toBe('Hearing');
    expect(deadlineRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: counsel.id,
        caseId: 'case-1',
      }),
    );
  });

  it('rejects counsel creating on another counsel case', async () => {
    deadlineRepository.findParentOwner.mockResolvedValue({
      ownerId: otherCounsel.id,
    });
    matterInvolvement.isUserInvolvedInParent.mockResolvedValue(false);

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
      useCase.execute(manager, {
        title: 'X',
        dueDate,
        caseId: 'case-1',
        assigneeId: 'inactive-user',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
