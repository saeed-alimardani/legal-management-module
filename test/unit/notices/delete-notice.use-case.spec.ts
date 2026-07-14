import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { DeleteNoticeUseCase } from '../../../src/modules/notices/application/delete-notice.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DeleteNoticeUseCase', () => {
  let useCase: DeleteNoticeUseCase;
  let noticeRepository: jest.Mocked<
    Pick<PrismaNoticeRepository, 'findById' | 'softDelete'>
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

  const existing = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'To Delete',
    ownerId: counsel.id,
  };

  beforeEach(() => {
    noticeRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      softDelete: jest.fn().mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteNoticeUseCase(
      noticeRepository as unknown as PrismaNoticeRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('soft deletes notice and logs activity for manager', async () => {
    const result = await useCase.execute(manager, existing.id);

    expect(result.data).toEqual({ success: true });
    expect(noticeRepository.softDelete).toHaveBeenCalledWith(existing.id);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.DELETED,
      entityType: EntityType.NOTICE,
      entityId: existing.id,
      metadata: {
        referenceCode: existing.referenceCode,
        title: existing.title,
      },
    });
  });

  it('denies counsel from deleting', async () => {
    await expect(useCase.execute(counsel, existing.id)).rejects.toThrow(
      ForbiddenException,
    );
    expect(noticeRepository.softDelete).not.toHaveBeenCalled();
  });

  it('throws when notice not found', async () => {
    noticeRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(manager, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
