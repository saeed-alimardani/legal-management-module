import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CaseStatus,
  CaseType,
  Priority,
  UserRole,
} from '@prisma/client';
import { GetCaseUseCase } from '../../../src/modules/cases/application/get-case.use-case';
import { PrismaCaseRepository } from '../../../src/modules/cases/infrastructure/prisma-case.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetCaseUseCase', () => {
  let useCase: GetCaseUseCase;
  let caseRepository: jest.Mocked<Pick<PrismaCaseRepository, 'findById'>>;

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

  const legalCase = {
    id: 'case-1',
    referenceCode: 'CASE-2026-00001',
    title: 'Owned Case',
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
      findById: jest.fn().mockResolvedValue(legalCase),
    };

    useCase = new GetCaseUseCase(
      caseRepository as unknown as PrismaCaseRepository,
      new AccessControlService(),
    );
  });

  it('returns case for owner counsel', async () => {
    const result = await useCase.execute(counsel, legalCase.id);

    expect(result.data).toEqual(legalCase);
  });

  it('returns case for admin regardless of ownership', async () => {
    const result = await useCase.execute(admin, legalCase.id);

    expect(result.data.id).toBe(legalCase.id);
  });

  it('denies counsel access to another counsels case', async () => {
    await expect(
      useCase.execute(otherCounsel, legalCase.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when case is not found', async () => {
    caseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(admin, 'missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
