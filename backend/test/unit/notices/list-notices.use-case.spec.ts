import { ConfigService } from '@nestjs/config';
import { NoticeStatus, UserRole } from '@prisma/client';
import { ListNoticesUseCase } from '../../../src/modules/notices/application/list-notices.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListNoticesUseCase', () => {
  let useCase: ListNoticesUseCase;
  let noticeRepository: jest.Mocked<Pick<PrismaNoticeRepository, 'list'>>;

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

  const noticeRow = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'Notice',
    sender: 'Sender',
    receivedDate: new Date('2026-07-01T00:00:00.000Z'),
    responseDeadline: new Date('2026-07-15T00:00:00.000Z'),
    status: NoticeStatus.RECEIVED,
    ownerId: counsel.id,
    description: null,
    relatedCaseId: null,
    relatedContractId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    noticeRepository = {
      list: jest.fn().mockResolvedValue({
        items: [noticeRow],
        total: 1,
      }),
    };

    useCase = new ListNoticesUseCase(
      noticeRepository as unknown as PrismaNoticeRepository,
      new AccessControlService(),
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('scopes counsel list to owned notices only', async () => {
    await useCase.execute(counsel, { page: 1, limit: 20 });

    expect(noticeRepository.list).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      { ownerId: counsel.id },
    );
  });

  it('does not scope admin list', async () => {
    await useCase.execute(admin, { page: 1, limit: 10 });

    expect(noticeRepository.list).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      {},
    );
  });

  it('maps Persian fields onto paginated data', async () => {
    const result = await useCase.execute(admin, { page: 1, limit: 20 });

    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(result.data[0].receivedDatePersian).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(result.data[0].responseDeadlinePersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );
  });

  it('passes status and owner filters', async () => {
    await useCase.execute(admin, {
      page: 1,
      limit: 20,
      status: NoticeStatus.OVERDUE,
      ownerId: 'owner-1',
    });

    expect(noticeRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: NoticeStatus.OVERDUE,
        ownerId: 'owner-1',
      }),
      {},
    );
  });
});
