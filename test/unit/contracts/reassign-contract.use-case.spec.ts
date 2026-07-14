import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ContractStatus,
  ContractType,
  EntityType,
  UserRole,
} from '@prisma/client';
import { ReassignContractUseCase } from '../../../src/modules/contracts/application/reassign-contract.use-case';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ReassignContractUseCase', () => {
  let useCase: ReassignContractUseCase;
  let contractRepository: jest.Mocked<
    Pick<
      PrismaContractRepository,
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
    id: 'contract-1',
    referenceCode: 'CTR-2026-00001',
    title: 'Reassign Me',
    type: ContractType.MSA,
    status: ContractStatus.ACTIVE,
    ownerId: counsel.id,
    counterpartyName: 'Acme',
    effectiveDate: null,
    expirationDate: null,
    renewalDate: null,
    keyTerms: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    contractRepository = {
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

    useCase = new ReassignContractUseCase(
      contractRepository as unknown as PrismaContractRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('reassigns ownership and logs activity', async () => {
    const result = await useCase.execute(manager, existing.id, newOwnerId);

    expect(result.data.ownerId).toBe(newOwnerId);
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.REASSIGNED,
      entityType: EntityType.CONTRACT,
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
    expect(contractRepository.reassign).not.toHaveBeenCalled();
    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('denies counsel from reassigning', async () => {
    await expect(
      useCase.execute(counsel, existing.id, newOwnerId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when new owner is invalid', async () => {
    contractRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, existing.id, 'invalid-owner'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when contract not found', async () => {
    contractRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(manager, 'missing', newOwnerId),
    ).rejects.toThrow(NotFoundException);
  });
});
