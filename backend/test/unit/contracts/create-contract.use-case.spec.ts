import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  ContractStatus,
  ContractType,
  EntityType,
  UserRole,
} from '@prisma/client';
import { CreateContractUseCase } from '../../../src/modules/contracts/application/create-contract.use-case';
import { toContractResponse } from '../../../src/modules/contracts/application/contract.helpers';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { ActivityLogService } from '../../../src/shared/activity-log/activity-log.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('CreateContractUseCase', () => {
  let useCase: CreateContractUseCase;
  let contractRepository: jest.Mocked<
    Pick<
      PrismaContractRepository,
      'generateNextReferenceCode' | 'create' | 'userExistsAndActive'
    >
  >;
  let activityLogService: jest.Mocked<Pick<ActivityLogService, 'log'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const createdContract = {
    id: 'contract-1',
    referenceCode: 'CTR-2026-00001',
    title: 'MSA Acme',
    type: ContractType.MSA,
    status: ContractStatus.DRAFT,
    ownerId: manager.id,
    counterpartyName: 'Acme Corp',
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
      generateNextReferenceCode: jest.fn().mockResolvedValue('CTR-2026-00001'),
      create: jest.fn().mockResolvedValue(createdContract),
      userExistsAndActive: jest.fn().mockResolvedValue(true),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: jest.fn().mockReturnValue('Asia/Tehran'),
    };

    useCase = new CreateContractUseCase(
      contractRepository as unknown as PrismaContractRepository,
      new AccessControlService(),
      activityLogService as unknown as ActivityLogService,
      configService as unknown as ConfigService,
    );
  });

  it('creates a contract for manager with self as owner and DRAFT status', async () => {
    const result = await useCase.execute(manager, {
      title: 'MSA Acme',
      type: ContractType.MSA,
      counterpartyName: 'Acme Corp',
    });

    expect(result.data).toEqual(
      toContractResponse(createdContract, 'Asia/Tehran'),
    );
    expect(contractRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: manager.id,
        referenceCode: 'CTR-2026-00001',
        status: ContractStatus.DRAFT,
        counterpartyName: 'Acme Corp',
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith({
      actorId: manager.id,
      action: AuditAction.CREATED,
      entityType: EntityType.CONTRACT,
      entityId: createdContract.id,
      metadata: expect.objectContaining({
        referenceCode: 'CTR-2026-00001',
        counterpartyName: 'Acme Corp',
      }),
    });
  });

  it('normalizes date fields to UTC midnight', async () => {
    await useCase.execute(manager, {
      title: 'Dated Contract',
      type: ContractType.NDA,
      counterpartyName: 'Beta LLC',
      effectiveDate: new Date('2026-01-15T15:30:00.000Z'),
      expirationDate: new Date('2026-12-31T22:00:00.000Z'),
      renewalDate: new Date('2026-11-01T08:00:00.000Z'),
    });

    expect(contractRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveDate: new Date('2026-01-15T00:00:00.000Z'),
        expirationDate: new Date('2026-12-31T00:00:00.000Z'),
        renewalDate: new Date('2026-11-01T00:00:00.000Z'),
      }),
    );
  });

  it('rejects when expirationDate is before effectiveDate', async () => {
    await expect(
      useCase.execute(manager, {
        title: 'Invalid Dates',
        type: ContractType.LEASE,
        counterpartyName: 'Landlord',
        effectiveDate: new Date('2026-06-01'),
        expirationDate: new Date('2026-01-01'),
      }),
    ).rejects.toThrow(BadRequestException);

    expect(contractRepository.create).not.toHaveBeenCalled();
  });

  it('allows equal effective and expiration dates', async () => {
    await useCase.execute(manager, {
      title: 'Same Day',
      type: ContractType.VENDOR,
      counterpartyName: 'Vendor',
      effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
      expirationDate: new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(contractRepository.create).toHaveBeenCalled();
  });

  it('allows manager to assign a different owner', async () => {
    const otherOwnerId = 'other-owner-id';

    await useCase.execute(manager, {
      title: 'Assigned Contract',
      type: ContractType.EMPLOYMENT,
      counterpartyName: 'Employee Inc',
      ownerId: otherOwnerId,
      status: ContractStatus.ACTIVE,
    });

    expect(contractRepository.userExistsAndActive).toHaveBeenCalledWith(
      otherOwnerId,
    );
    expect(contractRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: otherOwnerId,
        status: ContractStatus.ACTIVE,
      }),
    );
  });

  it('rejects counsel assigning a different owner', async () => {
    await expect(
      useCase.execute(counsel, {
        title: 'Bad Assign',
        type: ContractType.MSA,
        counterpartyName: 'Acme',
        ownerId: 'other-owner-id',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects viewer mutations', async () => {
    await expect(
      useCase.execute(viewer, {
        title: 'Viewer Contract',
        type: ContractType.OTHER,
        counterpartyName: 'Nobody',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when assigned owner does not exist', async () => {
    contractRepository.userExistsAndActive.mockResolvedValue(false);

    await expect(
      useCase.execute(manager, {
        title: 'Missing Owner',
        type: ContractType.NDA,
        counterpartyName: 'X',
        ownerId: 'missing-owner',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
