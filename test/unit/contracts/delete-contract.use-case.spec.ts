import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { DeleteContractUseCase } from '../../../src/modules/contracts/application/delete-contract.use-case';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('DeleteContractUseCase', () => {
  let useCase: DeleteContractUseCase;
  let contractRepository: jest.Mocked<
    Pick<PrismaContractRepository, 'findById' | 'softDelete'>
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
    id: 'contract-1',
    referenceCode: 'CTR-2026-00001',
    title: 'To Delete',
    ownerId: counsel.id,
  };

  beforeEach(() => {
    contractRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      softDelete: jest.fn().mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
      }),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteContractUseCase(
      contractRepository as unknown as PrismaContractRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('soft deletes contract and logs activity for manager', async () => {
    const result = await useCase.execute(manager, existing.id);

    expect(result.data).toEqual({ success: true });
    expect(contractRepository.softDelete).toHaveBeenCalledWith(existing.id);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.DELETED,
      entityType: EntityType.CONTRACT,
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
    expect(contractRepository.softDelete).not.toHaveBeenCalled();
  });

  it('throws when contract not found', async () => {
    contractRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(manager, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
