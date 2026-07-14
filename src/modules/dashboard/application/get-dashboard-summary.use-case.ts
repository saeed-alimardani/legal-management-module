import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CaseStatus,
  ContractStatus,
  DeadlineStatus,
  NoticeStatus,
  Prisma,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { todayInTimezone } from '../../../shared/utils/date-boundary.util';

export interface DashboardSummary {
  openCases: number;
  activeContracts: number;
  pendingNotices: number;
  overdueDeadlines: number;
  todayDeadlines: number;
  myOpenTasks: number;
}

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  async execute(user: AuthenticatedUser) {
    const timeZone =
      this.configService.get<string>(CONFIG_KEYS.APP_TIMEZONE) ?? 'UTC';
    const today = todayInTimezone(timeZone);
    const ownerScope = this.accessControl.buildOwnerListFilter(user);
    const deadlineScope = this.buildDeadlineScope(user);

    const [
      openCases,
      activeContracts,
      pendingNotices,
      overdueDeadlines,
      todayDeadlines,
      myOpenTasks,
    ] = await Promise.all([
      this.prisma.legalCase.count({
        where: {
          deletedAt: null,
          status: { in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS] },
          ...ownerScope,
        },
      }),
      this.prisma.contract.count({
        where: {
          deletedAt: null,
          status: ContractStatus.ACTIVE,
          ...ownerScope,
        },
      }),
      this.prisma.legalNotice.count({
        where: {
          deletedAt: null,
          status: { in: [NoticeStatus.RECEIVED, NoticeStatus.UNDER_REVIEW] },
          ...ownerScope,
        },
      }),
      this.prisma.deadline.count({
        where: {
          status: DeadlineStatus.PENDING,
          dueDate: { lt: today },
          ...deadlineScope,
        },
      }),
      this.prisma.deadline.count({
        where: {
          status: DeadlineStatus.PENDING,
          dueDate: today,
          ...deadlineScope,
        },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
          assigneeId: user.id,
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
        },
      }),
    ]);

    const summary: DashboardSummary = {
      openCases,
      activeContracts,
      pendingNotices,
      overdueDeadlines,
      todayDeadlines,
      myOpenTasks,
    };

    return buildSingleResponse(summary);
  }

  private buildDeadlineScope(
    user: AuthenticatedUser,
  ): Prisma.DeadlineWhereInput {
    if (user.role !== UserRole.LEGAL_COUNSEL) {
      return {};
    }

    return {
      OR: [
        { assigneeId: user.id },
        { legalCase: { ownerId: user.id, deletedAt: null } },
        { contract: { ownerId: user.id, deletedAt: null } },
        { notice: { ownerId: user.id, deletedAt: null } },
      ],
    };
  }
}
