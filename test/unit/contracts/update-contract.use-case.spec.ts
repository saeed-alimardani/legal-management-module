import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ContractStatus,
  ContractType,
  EntityType,
  UserRole,
} from '@prisma/client';
import { UpdateContractUseCase } from '../../../src/modules/contracts/application/update-contract.use-case';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('UpdateContractUseCase', () => {
  let useCase: UpdateContractUseCase;
  let contractRepository: jest.Mocked<
    Pick<PrismaContractRepository, 'findById' | 'update'>
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
    id: 'contract-1',
    referenceCode: 'CTR-2026-00001',
    title: 'Original Title',
    type: ContractType.MSA,
    status: ContractStatus.DRAFT,
    ownerId: counsel.id,
    counterpartyName: 'Acme Corp',
    effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
    expirationDate: new Date('2026-12-31T00:00:00.000Z'),
    renewalDate: null,
    keyTerms: 'Original terms',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    contractRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation((_id, input) =>
        Promise.resolve({
          ...existing,
          ...input,
        }),
      ),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new UpdateContractUseCase(
      contractRepository as unknown as PrismaContractRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
    );
  });

  it('updates fields for owner and logs UPDATED', async () => {
    const result = await useCase.execute(counsel, existing.id, {
      title: 'Updated Title',
      keyTerms: 'New terms',
    });

    expect(result.data.title).toBe('Updated Title');
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: counsel.id,
      action: AuditAction.UPDATED,
      entityType: EntityType.CONTRACT,
      entityId: existing.id,
      metadata: {
        fields: expect.arrayContaining(['title', 'keyTerms']),
      },
    });
  });

  it('logs STATUS_CHANGED when status changes', async () => {
    await useCase.execute(counsel, existing.id, {
      status: ContractStatus.ACTIVE,
    });

    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.STATUS_CHANGED,
        metadata: expect.objectContaining({
          from: ContractStatus.DRAFT,
          to: ContractStatus.ACTIVE,
        }),
      }),
    );
  });

  it('skips activity log when no fields change', async () => {
    await useCase.execute(counsel, existing.id, {
      title: existing.title,
    });

    expect(activityLogService.log).not.toHaveBeenCalled();
  });

  it('rejects invalid date range against existing effectiveDate', async () => {
    await expect(
      useCase.execute(counsel, existing.id, {
        expirationDate: new Date('2025-01-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(contractRepository.update).not.toHaveBeenCalled();
  });

  it('denies other counsel from editing', async () => {
    await expect(
      useCase.execute(otherCounsel, existing.id, { title: 'Hacked' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when contract not found', async () => {
    contractRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(counsel, 'missing', { title: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });
});
