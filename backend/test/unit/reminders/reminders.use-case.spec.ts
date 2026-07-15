import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  DeadlineStatus,
  EntityType,
  ReminderStatus,
  UserRole,
} from '@prisma/client';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { CreateReminderUseCase } from '../../../src/modules/reminders/application/create-reminder.use-case';
import { GetReminderUseCase } from '../../../src/modules/reminders/application/get-reminder.use-case';
import { ListRemindersUseCase } from '../../../src/modules/reminders/application/list-reminders.use-case';
import { ProcessDueRemindersUseCase } from '../../../src/modules/reminders/application/process-due-reminders.use-case';
import { UpdateReminderUseCase } from '../../../src/modules/reminders/application/update-reminder.use-case';
import { ReminderWithDeadline } from '../../../src/modules/reminders/domain/reminder.types';
import { PrismaReminderRepository } from '../../../src/modules/reminders/infrastructure/prisma-reminder.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { MatterInvolvementService } from '../../../src/shared/access-control/matter-involvement.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';
import { createMockConfigService } from '../../helpers/config.helper';
import { createMockMatterInvolvement } from '../../helpers/rbac.helper';

describe('CreateReminderUseCase', () => {
  let useCase: CreateReminderUseCase;
  let reminderRepository: jest.Mocked<Pick<PrismaReminderRepository, 'create'>>;
  let deadlineRepository: jest.Mocked<
    Pick<PrismaDeadlineRepository, 'findById'>
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;
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
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');
  const remindAt = new Date('2026-07-19T05:30:00.000Z');

  const deadline = {
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

  const buildReminder = (): ReminderWithDeadline => ({
    id: 'rem-1',
    deadlineId: deadline.id,
    remindAt,
    status: ReminderStatus.PENDING,
    message: 'Reminder message',
    sentAt: null,
    createdById: counsel.id,
    createdAt,
    updatedAt: createdAt,
    deadline: {
      assigneeId: null,
      legalCase: { ownerId: counsel.id, deletedAt: null },
      contract: null,
      notice: null,
    },
  });

  beforeEach(() => {
    deadlineRepository = {
      findById: jest.fn().mockResolvedValue(deadline),
    };

    reminderRepository = {
      create: jest.fn().mockResolvedValue(buildReminder()),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    matterInvolvement = createMockMatterInvolvement();

    useCase = new CreateReminderUseCase(
      reminderRepository as unknown as PrismaReminderRepository,
      deadlineRepository as unknown as PrismaDeadlineRepository,
      new AccessControlService(),
      matterInvolvement as unknown as MatterInvolvementService,
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('creates reminder on owned deadline as manager and logs activity', async () => {
    const result = await useCase.execute(manager, {
      deadlineId: deadline.id,
      remindAt,
      message: 'Reminder message',
    });

    expect(result.data.deadlineId).toBe(deadline.id);
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATED,
        entityType: EntityType.REMINDER,
        entityId: 'rem-1',
        actorId: manager.id,
      }),
    );
  });

  it('throws 404 when deadline not found', async () => {
    deadlineRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(manager, {
        deadlineId: 'missing',
        remindAt,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows counsel to create reminder on own matter deadline', async () => {
    const result = await useCase.execute(counsel, {
      deadlineId: deadline.id,
      remindAt,
      message: 'Reminder message',
    });

    expect(result.data.deadlineId).toBe(deadline.id);
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: counsel.id,
      }),
    );
  });

  it('throws 403 when counsel creates on another counsels deadline', async () => {
    deadlineRepository.findById.mockResolvedValue({
      ...deadline,
      legalCase: { ownerId: otherCounsel.id, deletedAt: null },
    });
    matterInvolvement.isUserInvolvedInParent.mockResolvedValue(false);

    await expect(
      useCase.execute(counsel, {
        deadlineId: deadline.id,
        remindAt,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when viewer tries to create', async () => {
    await expect(
      useCase.execute(viewer, {
        deadlineId: deadline.id,
        remindAt,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('GetReminderUseCase', () => {
  let useCase: GetReminderUseCase;
  let reminderRepository: jest.Mocked<
    Pick<PrismaReminderRepository, 'findById'>
  >;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const reminder: ReminderWithDeadline = {
    id: 'rem-1',
    deadlineId: 'dl-1',
    remindAt: new Date('2026-07-19T05:30:00.000Z'),
    status: ReminderStatus.PENDING,
    message: 'Reminder message',
    sentAt: null,
    createdById: counsel.id,
    createdAt,
    updatedAt: createdAt,
    deadline: {
      assigneeId: null,
      legalCase: { ownerId: counsel.id, deletedAt: null },
      contract: null,
      notice: null,
    },
  };

  beforeEach(() => {
    reminderRepository = {
      findById: jest.fn().mockResolvedValue(reminder),
    };

    useCase = new GetReminderUseCase(
      reminderRepository as unknown as PrismaReminderRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('returns reminder for authorized user', async () => {
    const result = await useCase.execute(counsel, reminder.id);

    expect(result.data.id).toBe(reminder.id);
    expect(result.data.remindAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('denies unauthorized counsel', async () => {
    await expect(useCase.execute(otherCounsel, reminder.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when reminder not found', async () => {
    reminderRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ListRemindersUseCase', () => {
  let useCase: ListRemindersUseCase;
  let reminderRepository: jest.Mocked<
    Pick<PrismaReminderRepository, 'list'>
  >;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');

  const reminders: ReminderWithDeadline[] = [
    {
      id: 'rem-1',
      deadlineId: 'dl-1',
      remindAt: new Date('2026-07-19T05:30:00.000Z'),
      status: ReminderStatus.PENDING,
      message: 'Reminder message',
      sentAt: null,
      createdById: counsel.id,
      createdAt,
      updatedAt: createdAt,
      deadline: {
        assigneeId: null,
        legalCase: { ownerId: counsel.id, deletedAt: null },
        contract: null,
        notice: null,
      },
    },
  ];

  beforeEach(() => {
    reminderRepository = {
      list: jest.fn().mockResolvedValue({ items: reminders, total: 1 }),
    };

    useCase = new ListRemindersUseCase(
      reminderRepository as unknown as PrismaReminderRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('returns paginated reminders with counsel scope', async () => {
    const result = await useCase.execute(counsel, {
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(reminderRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        currentUserId: counsel.id,
      }),
      { counselUserId: counsel.id },
    );
  });
});

describe('UpdateReminderUseCase', () => {
  let useCase: UpdateReminderUseCase;
  let reminderRepository: jest.Mocked<
    Pick<PrismaReminderRepository, 'findById' | 'update'>
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

  const otherCounsel: AuthenticatedUser = {
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');
  const remindAt = new Date('2026-07-19T05:30:00.000Z');

  const reminder: ReminderWithDeadline = {
    id: 'rem-1',
    deadlineId: 'dl-1',
    remindAt,
    status: ReminderStatus.PENDING,
    message: 'Original message',
    sentAt: null,
    createdById: counsel.id,
    createdAt,
    updatedAt: createdAt,
    deadline: {
      assigneeId: null,
      legalCase: { ownerId: counsel.id, deletedAt: null },
      contract: null,
      notice: null,
    },
  };

  beforeEach(() => {
    reminderRepository = {
      findById: jest.fn().mockResolvedValue(reminder),
      update: jest.fn().mockResolvedValue({
        ...reminder,
        message: 'Updated message',
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateReminderUseCase(
      reminderRepository as unknown as PrismaReminderRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('updates reminder and logs activity for manager', async () => {
    const result = await useCase.execute(manager, reminder.id, {
      message: 'Updated message',
    });

    expect(result.data.message).toBe('Updated message');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATED,
        entityType: EntityType.REMINDER,
        entityId: reminder.id,
        metadata: { fields: ['message'] },
      }),
    );
  });

  it('allows counsel to update a reminder they created', async () => {
    reminderRepository.update.mockResolvedValue({
      ...reminder,
      message: 'Counsel update',
    });

    const result = await useCase.execute(counsel, reminder.id, {
      message: 'Counsel update',
    });

    expect(result.data.message).toBe('Counsel update');
  });

  it('denies unauthorized counsel', async () => {
    await expect(
      useCase.execute(otherCounsel, reminder.id, {
        message: 'Updated message',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when reminder not found', async () => {
    reminderRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(manager, 'missing', { message: 'Updated message' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ProcessDueRemindersUseCase', () => {
  let useCase: ProcessDueRemindersUseCase;
  let reminderRepository: jest.Mocked<
    Pick<
      PrismaReminderRepository,
      'findDuePending' | 'markSent'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const createdAt = new Date('2026-07-14T10:00:00.000Z');
  const remindAt = new Date('2026-07-19T05:30:00.000Z');

  const dueReminder: ReminderWithDeadline = {
    id: 'rem-1',
    deadlineId: 'dl-1',
    remindAt,
    status: ReminderStatus.PENDING,
    message: 'Due reminder',
    sentAt: null,
    createdById: 'counsel-id',
    createdAt,
    updatedAt: createdAt,
    deadline: {
      assigneeId: null,
      legalCase: { ownerId: 'counsel-id', deletedAt: null },
      contract: null,
      notice: null,
    },
  };

  beforeEach(() => {
    reminderRepository = {
      findDuePending: jest.fn().mockResolvedValue([dueReminder]),
      markSent: jest.fn().mockResolvedValue({
        ...dueReminder,
        status: ReminderStatus.SENT,
        sentAt: new Date('2026-07-19T05:30:00.000Z'),
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ProcessDueRemindersUseCase(
      reminderRepository as unknown as PrismaReminderRepository,
      activityLogService as unknown as ActivityLogService,
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('processes due reminders and logs REMINDER_SENT', async () => {
    const result = await useCase.execute(admin);

    expect(result.data.processedCount).toBe(1);
    expect(result.data.reminders).toHaveLength(1);
    expect(reminderRepository.markSent).toHaveBeenCalledWith(
      dueReminder.id,
      expect.any(Date),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.REMINDER_SENT,
        entityType: EntityType.REMINDER,
        entityId: dueReminder.id,
        actorId: admin.id,
      }),
    );
  });

  it('returns zero processed when no due reminders', async () => {
    reminderRepository.findDuePending.mockResolvedValue([]);

    const result = await useCase.execute(admin);

    expect(result.data.processedCount).toBe(0);
    expect(result.data.reminders).toEqual([]);
    expect(reminderRepository.markSent).not.toHaveBeenCalled();
  });
});
