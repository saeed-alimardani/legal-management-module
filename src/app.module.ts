import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { ActivityLogReadModule } from './modules/activity-log/activity-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DeadlinesModule } from './modules/deadlines/deadlines.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DiscussionsModule } from './modules/discussions/discussions.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FinancialRecordsModule } from './modules/financial-records/financial-records.module';
import { HealthModule } from './modules/health/health.module';
import { OffboardingModule } from './modules/offboarding/offboarding.module';
import { NoticesModule } from './modules/notices/notices.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AccessControlModule } from './shared/access-control/access-control.module';
import { ActivityLogModule } from './shared/activity-log/activity-log.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    PrismaModule,
    AccessControlModule,
    ActivityLogModule,
    AuthModule,
    CasesModule,
    ContractsModule,
    NoticesModule,
    DeadlinesModule,
    RemindersModule,
    TasksModule,
    DocumentsModule,
    DiscussionsModule,
    FinancialRecordsModule,
    ActivityLogReadModule,
    DashboardModule,
    OffboardingModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
