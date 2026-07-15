import { UserRole } from '@prisma/client';
import { GetDashboardSummaryUseCase } from '../../../src/modules/dashboard/application/get-dashboard-summary.use-case';
import { AuthenticatedUser } from '../../../src/shared/types/authenticated-user.type';

describe('GetDashboardSummaryUseCase', () => {
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

  const manager: AuthenticatedUser = {
    id: 'manager-id',
    email: 'manager@legal.local',
    fullName: 'Manager',
    role: UserRole.LEGAL_MANAGER,
  };

  const today = new Date('2026-07-14T00:00:00.000Z');

  const prisma = {
    legalCase: { count: jest.fn() },
    contract: { count: jest.fn() },
    legalNotice: { count: jest.fn() },
    deadline: { count: jest.fn() },
    task: { count: jest.fn() },
  };

  const accessControl = {
    canViewAll: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockReturnValue('Asia/Tehran'),
  };

  let useCase: GetDashboardSummaryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessControl.canViewAll.mockImplementation((user: AuthenticatedUser) =>
      user.role !== UserRole.LEGAL_COUNSEL,
    );
    prisma.legalCase.count.mockResolvedValue(2);
    prisma.contract.count.mockResolvedValue(1);
    prisma.legalNotice.count.mockResolvedValue(1);
    prisma.deadline.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    prisma.task.count.mockResolvedValue(4);

    useCase = new GetDashboardSummaryUseCase(
      prisma as never,
      accessControl as never,
      configService as never,
    );

    jest
      .spyOn(
        require('../../../src/shared/utils/date-boundary.util'),
        'todayInTimezone',
      )
      .mockReturnValue(today);
  });

  it('returns all and my sections for admin', async () => {
    const result = await useCase.execute(admin);

    expect(result.data.canViewAll).toBe(true);
    expect(result.data.all.openCases).toBe(2);
    expect(result.data.my.openCases).toBe(2);
    expect(prisma.task.count).toHaveBeenCalled();
  });

  it('returns only my section for counsel using owned matters', async () => {
    accessControl.canViewAll.mockReturnValue(false);

    const result = await useCase.execute(counsel);

    expect(result.data.canViewAll).toBe(false);
    expect(result.data.all.myOpenTasks).toBe(0);
    expect(result.data.my.openCases).toBe(2);
    expect(prisma.legalCase.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ownerId: counsel.id,
      }),
    });
    expect(prisma.contract.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        ownerId: counsel.id,
      }),
    });
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ assigneeId: counsel.id }),
    });
  });

  it('scopes manager my-work matters to owned only', async () => {
    accessControl.canViewAll.mockReturnValue(true);
    prisma.legalCase.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0);
    prisma.contract.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    prisma.legalNotice.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prisma.deadline.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.task.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);

    const result = await useCase.execute(manager);

    expect(result.data.my.openCases).toBe(0);
    expect(result.data.my.activeContracts).toBe(0);
    expect(result.data.my.pendingNotices).toBe(1);
    expect(prisma.legalCase.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        ownerId: manager.id,
      }),
    });
    expect(prisma.deadline.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ assigneeId: manager.id }),
    });
  });

  it('counts counsel my-work deadlines by assignee only', async () => {
    accessControl.canViewAll.mockReturnValue(false);
    prisma.legalCase.count.mockResolvedValue(1);
    prisma.contract.count.mockResolvedValue(1);
    prisma.legalNotice.count.mockResolvedValue(1);
    prisma.deadline.count.mockResolvedValue(0);
    prisma.task.count.mockResolvedValue(3);

    await useCase.execute(counsel);

    expect(prisma.deadline.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ assigneeId: counsel.id }),
    });
    expect(prisma.deadline.count).not.toHaveBeenCalledWith({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    });
  });
});
