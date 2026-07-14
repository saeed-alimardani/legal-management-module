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

  const today = new Date('2026-07-14T00:00:00.000Z');

  const prisma = {
    legalCase: { count: jest.fn() },
    contract: { count: jest.fn() },
    legalNotice: { count: jest.fn() },
    deadline: { count: jest.fn() },
    task: { count: jest.fn() },
  };

  const accessControl = {
    buildOwnerListFilter: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockReturnValue('Asia/Tehran'),
  };

  let useCase: GetDashboardSummaryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    accessControl.buildOwnerListFilter.mockReturnValue({});
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

  it('returns aggregated counts for admin without owner scope', async () => {
    const result = await useCase.execute(admin);

    expect(accessControl.buildOwnerListFilter).toHaveBeenCalledWith(admin);
    expect(result.data).toEqual({
      openCases: 2,
      activeContracts: 1,
      pendingNotices: 1,
      overdueDeadlines: 3,
      todayDeadlines: 2,
      myOpenTasks: 4,
    });
  });

  it('applies counsel owner scope to matter counts', async () => {
    accessControl.buildOwnerListFilter.mockReturnValue({ ownerId: counsel.id });

    await useCase.execute(counsel);

    expect(prisma.legalCase.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ ownerId: counsel.id }),
    });
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ assigneeId: counsel.id }),
    });
  });

  it('applies counsel deadline scope with parent ownership or assignment', async () => {
    await useCase.execute(counsel);

    expect(prisma.deadline.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [
          { assigneeId: counsel.id },
          { legalCase: { ownerId: counsel.id, deletedAt: null } },
          { contract: { ownerId: counsel.id, deletedAt: null } },
          { notice: { ownerId: counsel.id, deletedAt: null } },
        ],
      }),
    });
  });
});
