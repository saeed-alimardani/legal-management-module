import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContractStatus, ContractType, UserRole } from '@prisma/client';
import { GetContractUseCase } from '../../../src/modules/contracts/application/get-contract.use-case';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetContractUseCase', () => {
  let useCase: GetContractUseCase;
  let contractRepository: jest.Mocked<
    Pick<PrismaContractRepository, 'findById'>
  >;

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

  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const viewer: AuthenticatedUser = {
    id: 'viewer-id',
    email: 'viewer@legal.local',
    fullName: 'Viewer',
    role: UserRole.VIEWER,
  };

  const contract = {
    id: 'contract-1',
    referenceCode: 'CTR-2026-00001',
    title: 'Owned Contract',
    type: ContractType.MSA,
    status: ContractStatus.ACTIVE,
    ownerId: counsel.id,
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
      findById: jest.fn().mockResolvedValue(contract),
    };

    useCase = new GetContractUseCase(
      contractRepository as unknown as PrismaContractRepository,
      new AccessControlService(),
    );
  });

  it('returns contract for owner counsel', async () => {
    const result = await useCase.execute(counsel, contract.id);
    expect(result.data).toEqual(contract);
  });

  it('returns contract for admin and viewer regardless of ownership', async () => {
    expect((await useCase.execute(admin, contract.id)).data.id).toBe(
      contract.id,
    );
    expect((await useCase.execute(viewer, contract.id)).data.id).toBe(
      contract.id,
    );
  });

  it('denies counsel access to another counsels contract', async () => {
    await expect(useCase.execute(otherCounsel, contract.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when contract is not found', async () => {
    contractRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(admin, 'missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
