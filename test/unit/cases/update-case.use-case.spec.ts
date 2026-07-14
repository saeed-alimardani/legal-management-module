import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  Priority,
  UserRole,
} from '@prisma/client';
import { UpdateCaseUseCase } from '../../../src/modules/cases/application/update-case.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('UpdateCaseUseCase', () => {
  let useCase: UpdateCaseUseCase;
  let caseRepository: jest.Mocked<
    Pick<PrismaCaseRepository, 'findById' | 'update'>
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

  const existingCase = {
    id: 'case-1',
    referenceCode: 'CASE-2026-00001',
    title: 'Original Title',
    type: CaseType.LITIGATION,
    status: CaseStatus.OPEN,
    priority: Priority.HIGH,
    ownerId: counsel.id,
    description: 'Original description',
    openedDate: null,
    closedDate: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    parties: [],
  };

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(existingCase),
      update: jest.fn().mockImplementation((_id, input) =>
        Promise.resolve({
          ...existingCase,
          ...input,
        }),
      ),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateCaseUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('updates case fields for owner', async () => {
    const result = await useCase.execute(counsel, existingCase.id, {
      title: 'Updated Title',
    });

    expect(result.data.title).toBe('Updated Title');
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CASE,
      entityId: existingCase.id,
      metadata: { fields: ['title'] },
    });
  });

  it('logs STATUS_CHANGED when status changes', async () => {
    await useCase.execute(counsel, existingCase.id, {
      status: CaseStatus.IN_PROGRESS,
    });

    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.STATUS_CHANGED,
      entityType: EntityType.CASE,
      entityId: existingCase.id,
      metadata: {
        from: CaseStatus.OPEN,
        to: CaseStatus.IN_PROGRESS,
        fields: ['status'],
      },
    });
  });

  it('skips activity log when no fields changed', async () => {
    await useCase.execute(counsel, existingCase.id, {
      title: existingCase.title,
    });

    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('denies counsel editing another counsels case', async () => {
    await expect(
      useCase.execute(otherCounsel, existingCase.id, { title: 'Hacked' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });
});
