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
  NoticeStatus,
  UserRole,
} from '@prisma/client';
import { CreateNoticeUseCase } from '../../../src/modules/notices/application/create-notice.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('CreateNoticeUseCase', () => {
  let useCase: CreateNoticeUseCase;
  let noticeRepository: jest.Mocked<
    Pick<
      PrismaNoticeRepository,
      | 'generateNextReferenceCode'
      | 'userExistsAndActive'
      | 'relatedCaseExists'
      | 'relatedContractExists'
    >
  >;
  let prisma: {
    $transaction: jest.Mock;
  };
  let tx: {
    legalNotice: { create: jest.Mock };
    deadline: { create: jest.Mock };
    reminder: { create: jest.Mock };
  };
  let activityLogService: jest.Mocked<
    Pick<ActivityLogService, 'logWithinTransaction'>
  >;

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

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const createdNotice = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'Demand Letter',
    sender: 'Vendor X',
    receivedDate: new Date('2026-07-01T00:00:00.000Z'),
    responseDeadline: new Date('2026-07-15T00:00:00.000Z'),
    status: NoticeStatus.RECEIVED,
    ownerId: manager.id,
    description: null,
    relatedCaseId: null,
    relatedContractId: null,
    deletedAt: null,
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    updatedAt: new Date('2026-07-01T10:00:00.000Z'),
  };

  const createdDeadline = {
    id: 'deadline-1',
    title: 'Response deadline: Demand Letter',
    dueDate: new Date('2026-07-15T00:00:00.000Z'),
    status: DeadlineStatus.PENDING,
    assigneeId: manager.id,
    noticeId: 'notice-1',
    createdById: manager.id,
  };

  beforeEach(() => {
    noticeRepository = {
      generateNextReferenceCode: jest.fn().mockResolvedValue('NTC-2026-00001'),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
      relatedCaseExists: jest.fn().mockResolvedValue(true),
      relatedContractExists: jest.fn().mockResolvedValue(true),
    };

    tx = {
      legalNotice: {
        create: jest.fn().mockResolvedValue(createdNotice),
      },
      deadline: {
        create: jest.fn().mockResolvedValue(createdDeadline),
      },
      reminder: {
        create: jest.fn().mockResolvedValue({
          id: 'reminder-1',
          deadlineId: 'deadline-1',
        }),
      },
    };

    prisma = {
      $transaction: jest.fn().mockImplementation(async (fn) => fn(tx)),
    };

    activityLogService = {
      logWithinTransaction: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new CreateNoticeUseCase(
      noticeRepository as unknown as PrismaNoticeRepository,
      prisma as unknown as PrismaService,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('creates notice + auto deadline in one transaction with dual activity logs', async () => {
    const result = await useCase.execute(manager, {
      title: 'Demand Letter',
      sender: 'Vendor X',
      receivedDate: new Date('2026-07-01T15:00:00.000Z'),
      responseDeadline: new Date('2026-07-15T22:00:00.000Z'),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(tx.legalNotice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        referenceCode: 'NTC-2026-00001',
        title: 'Demand Letter',
        sender: 'Vendor X',
        receivedDate: new Date('2026-07-01T00:00:00.000Z'),
        responseDeadline: new Date('2026-07-15T00:00:00.000Z'),
        status: NoticeStatus.RECEIVED,
        ownerId: manager.id,
      }),
    });

    expect(tx.deadline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Response deadline: Demand Letter',
        dueDate: new Date('2026-07-15T00:00:00.000Z'),
        status: DeadlineStatus.PENDING,
        assigneeId: manager.id,
        noticeId: createdNotice.id,
        createdById: manager.id,
      }),
    });

    expect(tx.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deadlineId: createdDeadline.id,
        createdById: manager.id,
      }),
    });

    expect(activityLogService.logWithinTransaction).toHaveBeenCalledTimes(2);
    expect(activityLogService.logWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.NOTICE,
        entityId: createdNotice.id,
        metadata: expect.objectContaining({
          deadlineId: createdDeadline.id,
        }),
      }),
    );
    expect(activityLogService.logWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.DEADLINE,
        entityId: createdDeadline.id,
        metadata: expect.objectContaining({
          noticeId: createdNotice.id,
          autoCreated: true,
        }),
      }),
    );

    expect(result.data.id).toBe(createdNotice.id);
    expect(result.data.responseDeadlinePersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );
    expect(result.data.receivedDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('rejects when responseDeadline is before receivedDate', async () => {
    await expect(
      useCase.execute(manager, {
        title: 'Bad Dates',
        sender: 'X',
        receivedDate: new Date('2026-07-15'),
        responseDeadline: new Date('2026-07-01'),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects viewer mutations', async () => {
    await expect(
      useCase.execute(viewer, {
        title: 'Viewer Notice',
        sender: 'X',
        receivedDate: new Date('2026-07-01'),
        responseDeadline: new Date('2026-07-15'),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects counsel assigning a different owner', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'Notice',
        sender: 'X',
        receivedDate: new Date('2026-07-01'),
        responseDeadline: new Date('2026-07-15'),
        ownerId: 'other-owner',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows manager to assign a different owner and uses it for deadline assignee', async () => {
    const otherOwnerId = 'other-owner-id';
    tx.legalNotice.create.mockResolvedValue({
      ...createdNotice,
      ownerId: otherOwnerId,
    });
    tx.deadline.create.mockResolvedValue({
      ...createdDeadline,
      assigneeId: otherOwnerId,
    });

    await useCase.execute(manager, {
      title: 'Assigned Notice',
      sender: 'Sender',
      receivedDate: new Date('2026-07-01'),
      responseDeadline: new Date('2026-07-15'),
      ownerId: otherOwnerId,
    });

    expect(noticeRepository.userExistsAndActive).toHaveBeenCalledWith(
      otherOwnerId,
    );
    expect(tx.legalNotice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerId: otherOwnerId }),
    });
    expect(tx.deadline.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assigneeId: otherOwnerId }),
    });
  });

  it('throws when related case does not exist', async () => {
    noticeRepository.relatedCaseExists.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, {
        title: 'Notice',
        sender: 'X',
        receivedDate: new Date('2026-07-01'),
        responseDeadline: new Date('2026-07-15'),
        relatedCaseId: 'missing-case',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when related contract does not exist', async () => {
    noticeRepository.relatedContractExists.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, {
        title: 'Notice',
        sender: 'X',
        receivedDate: new Date('2026-07-01'),
        responseDeadline: new Date('2026-07-15'),
        relatedContractId: 'missing-contract',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when assigned owner does not exist', async () => {
    noticeRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, {
        title: 'Notice',
        sender: 'X',
        receivedDate: new Date('2026-07-01'),
        responseDeadline: new Date('2026-07-15'),
        ownerId: 'missing-owner',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists optional related matter ids', async () => {
    await useCase.execute(manager, {
      title: 'Linked Notice',
      sender: 'X',
      receivedDate: new Date('2026-07-01'),
      responseDeadline: new Date('2026-07-15'),
      relatedCaseId: 'case-1',
      relatedContractId: 'contract-1',
      description: 'Linked to both',
      status: NoticeStatus.UNDER_REVIEW,
    });

    expect(noticeRepository.relatedCaseExists).toHaveBeenCalledWith('case-1');
    expect(noticeRepository.relatedContractExists).toHaveBeenCalledWith(
      'contract-1',
    );
    expect(tx.legalNotice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        relatedCaseId: 'case-1',
        relatedContractId: 'contract-1',
        description: 'Linked to both',
        status: NoticeStatus.UNDER_REVIEW,
      }),
    });
  });
});
