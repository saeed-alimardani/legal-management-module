import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { ListContractsUseCase } from '../../../src/modules/contracts/application/list-contracts.use-case';
import { toContractResponse } from '../../../src/modules/contracts/application/contract.helpers';
import { PrismaContractRepository } from '../../../src/modules/contracts/infrastructure/prisma-contract.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('ListContractsUseCase', () => {
  let useCase: ListContractsUseCase;
  let contractRepository: jest.Mocked<Pick<PrismaContractRepository, 'list'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  const listItem = {
    id: 'contract-1',
    referenceCode: 'CTR-2026-00001',
    title: 'Listed Contract',
    type: 'MSA' as never,
    status: 'ACTIVE' as never,
    ownerId: 'owner-1',
    counterpartyName: 'Acme',
    effectiveDate: null,
    expirationDate: null,
    renewalDate: null,
    keyTerms: null,
    deletedAt: null,
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    updatedAt: new Date('2026-07-14T10:00:00.000Z'),
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
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

  beforeEach(() => {
    contractRepository = {
      list: jest.fn().mockResolvedValue({
        items: [listItem],
        total: 1,
      }),
    };

    configService = {
      get: jest.fn().mockReturnValue('Asia/Tehran'),
    };

    useCase = new ListContractsUseCase(
      contractRepository as unknown as PrismaContractRepository,
      new AccessControlService(),
      configService as unknown as ConfigService,
    );
  });

  it('scopes counsel list to own contracts', async () => {
    await useCase.execute(counsel, { page: 1, limit: 20 });

    expect(contractRepository.list).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      { ownerId: counsel.id },
    );
  });

  it('does not scope admin or viewer list', async () => {
    await useCase.execute(admin, { page: 1, limit: 10 });
    expect(contractRepository.list).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      {},
    );

    await useCase.execute(viewer, { page: 1, limit: 10 });
    expect(contractRepository.list).toHaveBeenLastCalledWith(
      { page: 1, limit: 10 },
      {},
    );
  });

  it('returns paginated response shape', async () => {
    const result = await useCase.execute(admin, { page: 2, limit: 5 });

    expect(result).toEqual({
      data: [toContractResponse(listItem, 'Asia/Tehran')],
      meta: { page: 2, limit: 5, total: 1 },
    });
  });

  it('passes filters to repository', async () => {
    await useCase.execute(admin, {
      page: 1,
      limit: 20,
      status: 'ACTIVE' as never,
      type: 'MSA' as never,
      ownerId: 'owner-1',
    });

    expect(contractRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ACTIVE',
        type: 'MSA',
        ownerId: 'owner-1',
      }),
      {},
    );
  });
});
