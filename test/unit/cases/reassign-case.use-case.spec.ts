import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CaseStatus,
  CaseType,
  EntityType,
  Priority,
  UserRole,
} from '@prisma/client';
import { ReassignCaseUseCase } from '../../../src/modules/cases/application/reassign-case.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ReassignCaseUseCase', () => {
  let useCase: ReassignCaseUseCase;
  let caseRepository: jest.Mocked<
    Pick<
      PrismaCaseRepository,
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

  const existingCase = {
    id: 'case-1',
    referenceCode: 'CASE-2026-00001',
    title: 'Reassign Me',
    type: CaseType.LITIGATION,
    status: CaseStatus.OPEN,
    priority: Priority.HIGH,
    ownerId: counsel.id,
    description: null,
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
      reassign: jest.fn().mockResolvedValue({
        ...existingCase,
        ownerId: newOwnerId,
      }),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new ReassignCaseUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('reassigns ownership and logs activity', async () => {
    const result = await useCase.execute(manager, existingCase.id, newOwnerId);

    expect(result.data.ownerId).toBe(newOwnerId);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.CASE,
      entityId: existingCase.id,
      metadata: {
        fromUserId: counsel.id,
        toUserId: newOwnerId,
      },
    });
  });

  it('returns existing case without logging when owner unchanged', async () => {
    const result = await useCase.execute(manager, existingCase.id, counsel.id);

    expect(result.data.ownerId).toBe(counsel.id);
    expect(caseRepository.reassign).not.toHaveBeenCalled();
    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('denies counsel from reassigning', async () => {
    await expect(
      useCase.execute(counsel, existingCase.id, newOwnerId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when new owner is invalid', async () => {
    caseRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, existingCase.id, 'invalid-owner'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(manager, 'missing', newOwnerId),
    ).rejects.toThrow(NotFoundException);
  });
});
