import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EntityType,
  NoticeStatus,
  UserRole,
} from '@prisma/client';
import { ReassignNoticeUseCase } from '../../../src/modules/notices/application/reassign-notice.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ReassignNoticeUseCase', () => {
  let useCase: ReassignNoticeUseCase;
  let noticeRepository: jest.Mocked<
    Pick<
      PrismaNoticeRepository,
      'findById' | 'reassign' | 'userExistsAndActive'
    >
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

  const newOwnerId = 'counsel2-id';

  const existing = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'Reassign Me',
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
      findById: jest.fn().mockResolvedValue(existing),
      reassign: jest.fn().mockResolvedValue({
        ...existing,
        ownerId: newOwnerId,
      }),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ReassignNoticeUseCase(
      noticeRepository as unknown as PrismaNoticeRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('reassigns ownership and logs activity', async () => {
    const result = await useCase.execute(manager, existing.id, newOwnerId);

    expect(result.data.ownerId).toBe(newOwnerId);
    expect(result.data.responseDeadlinePersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.NOTICE,
      entityId: existing.id,
      metadata: {
        fromUserId: counsel.id,
        toUserId: newOwnerId,
      },
    });
  });

  it('returns existing without logging when owner unchanged', async () => {
    const result = await useCase.execute(manager, existing.id, counsel.id);

    expect(result.data.ownerId).toBe(counsel.id);
    expect(noticeRepository.reassign).not.toHaveBeenCalled();
    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('denies counsel from reassigning', async () => {
    await expect(
      useCase.execute(counsel, existing.id, newOwnerId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when new owner is invalid', async () => {
    noticeRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, existing.id, 'invalid-owner'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when notice not found', async () => {
    noticeRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(manager, 'missing', newOwnerId),
    ).rejects.toThrow(NotFoundException);
  });
});
