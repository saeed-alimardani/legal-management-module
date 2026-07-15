import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { DeleteCaseUseCase } from '../../../src/modules/cases/application/delete-case.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DeleteCaseUseCase', () => {
  let useCase: DeleteCaseUseCase;
  let caseRepository: jest.Mocked<
    Pick<PrismaCaseRepository, 'findById' | 'softDelete'>
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

  const existingCase = {
    id: 'case-1',
    referenceCode: 'CASE-2026-00001',
    title: 'To Delete',
    ownerId: counsel.id,
  };

  beforeEach(() => {
    caseRepository = {
      findById: jest.fn().mockResolvedValue(existingCase),
      softDelete: jest.fn().mockResolvedValue({
        ...existingCase,
        deletedAt: new Date(),
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteCaseUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('soft deletes case and logs activity for manager', async () => {
    const result = await useCase.execute(manager, existingCase.id);

    expect(result.data).toEqual({ success: true });
    expect(caseRepository.softDelete).toHaveBeenCalledWith(existingCase.id);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.DELETED,
      entityType: EntityType.CASE,
      entityId: existingCase.id,
      metadata: {
        referenceCode: existingCase.referenceCode,
        title: existingCase.title,
      },
    });
  });

  it('denies counsel from deleting', async () => {
    await expect(useCase.execute(counsel, existingCase.id)).rejects.toThrow(
      ForbiddenException,
    );
    expect(caseRepository.softDelete).not.toHaveBeenCalled();
  });

  it('throws when case not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(manager, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
