import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EntityType,
  NoticeStatus,
  UserRole,
} from '@prisma/client';
import { UpdateNoticeUseCase } from '../../../src/modules/notices/application/update-notice.use-case';
import { PrismaNoticeRepository } from '../../../src/modules/notices/infrastructure/prisma-notice.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('UpdateNoticeUseCase', () => {
  let useCase: UpdateNoticeUseCase;
  let noticeRepository: jest.Mocked<
    Pick<
      PrismaNoticeRepository,
      'findById' | 'update' | 'relatedCaseExists' | 'relatedContractExists'
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
    id: 'counsel2-id',
    email: 'counsel2@legal.local',
    fullName: 'Counsel Two',
    role: UserRole.LEGAL_COUNSEL,
  };

  const existing = {
    id: 'notice-1',
    referenceCode: 'NTC-2026-00001',
    title: 'Original',
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
      update: jest.fn().mockImplementation((_id, input) =>
        Promise.resolve({
          ...existing,
          ...input,
        }),
      ),
      relatedCaseExists: jest.fn().mockResolvedValue(true),
      relatedContractExists: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateNoticeUseCase(
      noticeRepository as unknown as PrismaNoticeRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      {
        get: jest.fn().mockReturnValue('Asia/Tehran'),
      } as unknown as ConfigService,
    );
  });

  it('updates fields for owner and logs UPDATED', async () => {
    const result = await useCase.execute(counsel, existing.id, {
      title: 'Updated',
      description: 'Notes',
    });

    expect(result.data.title).toBe('Updated');
    expect(result.data.responseDeadlinePersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2}$/,
    );
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.NOTICE,
      entityId: existing.id,
      metadata: {
        fields: expect.arrayContaining(['title', 'description']),
      },
    });
  });

  it('logs STATUS_CHANGED when status changes', async () => {
    await useCase.execute(counsel, existing.id, {
      status: NoticeStatus.RESPONDED,
    });

    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.STATUS_CHANGED,
        metadata: expect.objectContaining({
          from: NoticeStatus.RECEIVED,
          to: NoticeStatus.RESPONDED,
        }),
      }),
    );
  });

  it('rejects when responseDeadline is before receivedDate', async () => {
    await expect(
      useCase.execute(counsel, existing.id, {
        responseDeadline: new Date('2026-06-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(noticeRepository.update).not.toHaveBeenCalled();
  });

  it('validates related case existence', async () => {
    noticeRepository.relatedCaseExists.mockResolvedValue(false);

    await expect(
      useCase.execute(counsel, existing.id, {
        relatedCaseId: 'missing-case',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('denies other counsel from editing', async () => {
    await expect(
      useCase.execute(otherCounsel, existing.id, { title: 'Hacked' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when notice not found', async () => {
    noticeRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });
});
