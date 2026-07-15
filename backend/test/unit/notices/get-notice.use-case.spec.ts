import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoticeStatus, UserRole } from '@prisma/client';
import { GetNoticeUseCase } from '../../../src/modules/notices/application/get-notice.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetNoticeUseCase', () => {
  let useCase: GetNoticeUseCase;
  let noticeRepository: jest.Mocked<Pick<PrismaNoticeRepository, 'findById'>>;

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

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const notice = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'Owned Notice',
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
      findById: jest.fn().mockResolvedValue(notice),
    };

    useCase = new GetNoticeUseCase(
      noticeRepository as unknown as PrismaNoticeRepository,
      new AccessControlService(),
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('returns notice with Persian dates for owner', async () => {
    const result = await useCase.execute(counsel, notice.id);

    expect(result.data.id).toBe(notice.id);
    expect(result.data.responseDeadlinePersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );
  });

  it('returns notice for admin regardless of ownership', async () => {
    const result = await useCase.execute(admin, notice.id);
    expect(result.data.id).toBe(notice.id);
  });

  it('denies counsel access to another counsels notice', async () => {
    await expect(useCase.execute(otherCounsel, notice.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when notice is not found', async () => {
    noticeRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(admin, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
