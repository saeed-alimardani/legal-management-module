import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CaseStatus,
  ContractStatus,
  DeadlineStatus,
  NoticeStatus,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import { CONFIG_KEYS } from '../../../config/constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessControlService } from '../../../shared/access-control/access-control.service';
import {
  buildDashboardMyWorkDeadlineWhere,
} from '../../../shared/access-control/counsel-involvement.where';
import { buildSingleResponse } from '../../../shared/dto/paginated-response.dto';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user.type';
import { todayInTimezone } from '../../../shared/utils/date-boundary.util';

export interface DashboardMetrics {
  openCases: number;
  activeContracts: number;
  pendingNotices: number;
  overdueDeadlines: number;
  todayDeadlines: number;
  myOpenTasks: number;
}

export interface DashboardSummary {
  canViewAll: boolean;
  all: DashboardMetrics;
  my: DashboardMetrics;
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
    const canViewAll = this.accessControl.canViewAll(user);
    // My Work matters = owned by me. Deadlines/tasks = assigned to me.
    const myCaseScope: Prisma.LegalCaseWhereInput = { ownerId: user.id };
    const myContractScope: Prisma.ContractWhereInput = { ownerId: user.id };
    const myNoticeScope: Prisma.LegalNoticeWhereInput = { ownerId: user.id };
    const myDeadlineScope = buildDashboardMyWorkDeadlineWhere(user.id);

    const [all, my] = await Promise.all([
      canViewAll
        ? this.countMetrics({}, {}, {}, {}, today, undefined)
        : Promise.resolve(this.emptyMetrics()),
      this.countMetrics(
        myCaseScope,
        myContractScope,
        myNoticeScope,
        myDeadlineScope,
        today,
        user.id,
      ),
    ]);

    const summary: DashboardSummary = {
      canViewAll,
      all,
      my,
    };

    return buildSingleResponse(summary);
  }

  private emptyMetrics(): DashboardMetrics {
    return {
      openCases: 0,
      activeContracts: 0,
      pendingNotices: 0,
      overdueDeadlines: 0,
      todayDeadlines: 0,
      myOpenTasks: 0,
    };
  }

  private async countMetrics(
    caseScope: Prisma.LegalCaseWhereInput,
    contractScope: Prisma.ContractWhereInput,
    noticeScope: Prisma.LegalNoticeWhereInput,
    deadlineScope: Prisma.DeadlineWhereInput,
    today: Date,
    taskAssigneeId?: string,
  ): Promise<DashboardMetrics> {
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
          ...caseScope,
        },
      }),
      this.prisma.contract.count({
        where: {
          deletedAt: null,
          status: ContractStatus.ACTIVE,
          ...contractScope,
        },
      }),
      this.prisma.legalNotice.count({
        where: {
          deletedAt: null,
          status: { in: [NoticeStatus.RECEIVED, NoticeStatus.UNDER_REVIEW] },
          ...noticeScope,
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
          status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          ...(taskAssigneeId ? { assigneeId: taskAssigneeId } : {}),
        },
      }),
    ]);

    return {
      openCases,
      activeContracts,
      pendingNotices,
      overdueDeadlines,
      todayDeadlines,
      myOpenTasks,
    };
  }
}
