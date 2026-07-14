import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeadlineStatus, UserRole } from '@prisma/client';
import { GetDeadlineUseCase } from '../../../src/modules/deadlines/application/get-deadline.use-case';
import { PrismaDeadlineRepository } from '../../../src/modules/deadlines/infrastructure/prisma-deadline.repository';
import { AccessControlService } from '../../../src/shared/access-control/access-control.service';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetDeadlineUseCase', () => {
  let useCase: GetDeadlineUseCase;
  let deadlineRepository: jest.Mocked<Pick<PrismaDeadlineRepository, 'findById'>>;

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const otherCounsel: AuthenticatedUser = {
    id: 'other-id',
    email: 'other@legal.local',
    fullName: 'Other',
    role: UserRole.LEGAL_COUNSEL,
  };

  const deadline = {
    id: 'dl-1',
    title: 'Hearing',
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
    status: DeadlineStatus.PENDING,
    assigneeId: null as string | null,
    caseId: 'case-1',
    contractId: null,
    noticeId: null,
    completedAt: null,
    createdById: counsel.id,
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    updatedAt: new Date('2026-07-14T10:00:00.000Z'),
    legalCase: { ownerId: counsel.id, deletedAt: null },
    contract: null,
    notice: null,
  };

  beforeEach(() => {
    deadlineRepository = {
      findById: jest.fn().mockResolvedValue(deadline),
    };

    useCase = new GetDeadlineUseCase(
      deadlineRepository as unknown as PrismaDeadlineRepository,
      new AccessControlService(),
      { get: jest.fn().mockReturnValue('Asia/Tehran') } as unknown as ConfigService,
    );
  });

  it('returns deadline with Shamsi date fields for owner', async () => {
    const result = await useCase.execute(counsel, 'dl-1');

    expect(result.data.id).toBe('dl-1');
    expect(result.data.dueDatePersian).toBeTruthy();
    expect(result.data.createdAtPersian).toBeTruthy();
    expect(result.data.completedAtPersian).toBeNull();
  });

  it('allows assignee to view even if not parent owner', async () => {
    deadlineRepository.findById.mockResolvedValue({
      ...deadline,
      assigneeId: otherCounsel.id,
      legalCase: { ownerId: counsel.id, deletedAt: null },
    });

    await expect(useCase.execute(otherCounsel, 'dl-1')).resolves.toBeDefined();
  });

  it('forbids unrelated counsel', async () => {
    await expect(useCase.execute(otherCounsel, 'dl-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when deadline missing', async () => {
    deadlineRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(counsel, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws when parent matter is soft-deleted', async () => {
    deadlineRepository.findById.mockResolvedValue({
      ...deadline,
      legalCase: { ownerId: counsel.id, deletedAt: new Date() },
    });

    await expect(useCase.execute(counsel, 'dl-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
