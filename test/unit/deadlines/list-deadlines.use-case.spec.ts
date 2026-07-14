import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { ListDeadlinesUseCase } from '../../../src/modules/deadlines/application/list-deadlines.use-case';
import { DeadlineView } from '../../../src/modules/deadlines/domain/deadline-view.enum';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListDeadlinesUseCase', () => {
  let useCase: ListDeadlinesUseCase;
  let deadlineRepository: jest.Mocked<Pick<PrismaDeadlineRepository, 'list'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const fixedToday = new Date('2026-07-14T00:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedToday);

    deadlineRepository = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'dl-1',
            title: 'Hearing',
            dueDate: new Date('2026-07-20T00:00:00.000Z'),
            status: 'PENDING',
            assigneeId: counsel.id,
            caseId: 'case-1',
            contractId: null,
            noticeId: null,
            completedAt: null,
            createdById: counsel.id,
            createdAt: fixedToday,
            updatedAt: fixedToday,
          },
        ],
        total: 1,
      }),
    };

    configService = {
      get: jest.fn().mockReturnValue('Asia/Tehran'),
    };

    useCase = new ListDeadlinesUseCase(
      deadlineRepository as unknown as PrismaDeadlineRepository,
      new AccessControlService(),
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes overdue view filter with today boundary', async () => {
    await useCase.execute(admin, {
      page: 1,
      limit: 20,
      view: DeadlineView.OVERDUE,
    });

    expect(deadlineRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        view: DeadlineView.OVERDUE,
        today: fixedToday,
        currentUserId: admin.id,
        page: 1,
        limit: 20,
      }),
      {},
    );
  });

  it('passes today view filter', async () => {
    await useCase.execute(admin, {
      page: 1,
      limit: 10,
      view: DeadlineView.TODAY,
    });

    expect(deadlineRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ view: DeadlineView.TODAY, today: fixedToday }),
      {},
    );
  });

  it('passes upcoming view filter', async () => {
    await useCase.execute(admin, {
      page: 1,
      limit: 10,
      view: DeadlineView.UPCOMING,
    });

    expect(deadlineRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        view: DeadlineView.UPCOMING,
        today: fixedToday,
      }),
      {},
    );
  });

  it('passes assigned-to-me view with current user id', async () => {
    await useCase.execute(counsel, {
      page: 1,
      limit: 20,
      view: DeadlineView.ASSIGNED_TO_ME,
    });

    expect(deadlineRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        view: DeadlineView.ASSIGNED_TO_ME,
        currentUserId: counsel.id,
      }),
      { counselUserId: counsel.id },
    );
  });

  it('scopes counsel list and includes Shamsi date fields in response', async () => {
    const result = await useCase.execute(counsel, { page: 1, limit: 20 });

    expect(deadlineRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ currentUserId: counsel.id }),
      { counselUserId: counsel.id },
    );
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'dl-1',
        dueDatePersian: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}$/),
        createdAtPersian: expect.stringMatching(
          /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
        ),
        updatedAtPersian: expect.stringMatching(
          /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
        ),
        completedAtPersian: null,
      }),
    );
  });
});
