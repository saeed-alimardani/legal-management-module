import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType, UserRole } from '@prisma/client';
import { BulkTransferOwnershipUseCase } from '../../../src/modules/offboarding/application/bulk-transfer-ownership.use-case';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('BulkTransferOwnershipUseCase', () => {
  const admin: AuthenticatedUser = {
    id: 'admin-id',
    email: 'admin@legal.local',
    fullName: 'Admin',
    role: UserRole.LEGAL_ADMIN,
  };

  const counsel: AuthenticatedUser = {
    id: 'counsel-id',
    email: 'counsel@legal.local',
    fullName: 'Counsel',
    role: UserRole.LEGAL_COUNSEL,
  };

  const fromUserId = 'from-user-id';
  const toUserId = 'to-user-id';

  const accessControl = {
    assertCanManageUsers: jest.fn(),
  };

  const activityLogService = {
    logWithinTransaction: jest.fn(),
  };

  const tx = {
    legalCase: { updateMany: jest.fn() },
    contract: { updateMany: jest.fn() },
    legalNotice: { updateMany: jest.fn() },
    task: { updateMany: jest.fn() },
    deadline: { updateMany: jest.fn() },
  };

  const prisma = {
    user: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };

  let useCase: BulkTransferOwnershipUseCase;

  beforeEach(() => {
    jest.clearAllMocks();

    accessControl.assertCanManageUsers.mockImplementation(() => undefined);
    prisma.user.findFirst.mockResolvedValue({ id: fromUserId });
    tx.legalCase.updateMany.mockResolvedValue({ count: 2 });
    tx.contract.updateMany.mockResolvedValue({ count: 1 });
    tx.legalNotice.updateMany.mockResolvedValue({ count: 0 });
    tx.task.updateMany.mockResolvedValue({ count: 3 });
    tx.deadline.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    useCase = new BulkTransferOwnershipUseCase(
      prisma as never,
      accessControl as never,
      activityLogService as never,
    );
  });

  it('rejects non-admin users', async () => {
    accessControl.assertCanManageUsers.mockImplementationOnce(() => {
      throw new ForbiddenException();
    });

    await expect(
      useCase.execute(counsel, fromUserId, toUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects identical from and to users', async () => {
    await expect(
      useCase.execute(admin, fromUserId, fromUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inactive users', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: fromUserId })
      .mockResolvedValueOnce(null);

    await expect(
      useCase.execute(admin, fromUserId, toUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('transfers ownership and assignments in one transaction', async () => {
    const result = await useCase.execute(admin, fromUserId, toUserId);

    expect(accessControl.assertCanManageUsers).toHaveBeenCalledWith(admin);
    expect(tx.legalCase.updateMany).toHaveBeenCalledWith({
      where: { ownerId: fromUserId, deletedAt: null },
      data: { ownerId: toUserId },
    });
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { assigneeId: fromUserId, deletedAt: null },
      data: { assigneeId: toUserId },
    });
    expect(activityLogService.logWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: admin.id,
        action: AuditAction.OWNERSHIP_TRANSFERRED,
        entityType: EntityType.USER,
        entityId: toUserId,
        metadata: expect.objectContaining({
          fromUserId,
          toUserId,
          counts: {
            cases: 2,
            contracts: 1,
            notices: 0,
            tasks: 3,
            deadlines: 1,
          },
        }),
      }),
    );
    expect(result.data).toEqual({
      cases: 2,
      contracts: 1,
      notices: 0,
      tasks: 3,
      deadlines: 1,
    });
  });
});
