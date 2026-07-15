import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { ListCasesUseCase } from '../../../src/modules/cases/application/list-cases.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';
import { createMockConfigService } from '../../helpers/config.helper';

describe('ListCasesUseCase', () => {
  let useCase: ListCasesUseCase;
  let caseRepository: jest.Mocked<Pick<PrismaCaseRepository, 'list'>>;

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

  beforeEach(() => {
    caseRepository = {
      list: jest.fn().mockResolvedValue({
        items: [{ id: 'case-1' }],
        total: 1,
      }),
    };

    useCase = new ListCasesUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
      createMockConfigService() as unknown as ConfigService,
    );
  });

  it('scopes counsel list to own cases', async () => {
    await useCase.execute(counsel, { page: 1, limit: 20 });

    expect(caseRepository.list).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      { ownerId: counsel.id },
    );
  });

  it('does not scope admin list', async () => {
    await useCase.execute(admin, { page: 1, limit: 10 });

    expect(caseRepository.list).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      {},
    );
  });

  it('returns paginated response shape', async () => {
    const result = await useCase.execute(admin, { page: 2, limit: 5 });

    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1 });
    expect(result.data[0].id).toBe('case-1');
    expect(result.data[0].createdAtPersian).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('passes filters to repository', async () => {
    await useCase.execute(admin, {
      page: 1,
      limit: 20,
      status: 'OPEN' as never,
      type: 'LITIGATION' as never,
      ownerId: 'owner-1',
    });

    expect(caseRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'OPEN',
        type: 'LITIGATION',
        ownerId: 'owner-1',
      }),
      {},
    );
  });
});
