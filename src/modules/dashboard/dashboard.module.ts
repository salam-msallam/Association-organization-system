import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CaslModule } from 'src/casl/casl.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { HelpRequestStatsController } from './help-request-stats.controller';
import { AdminDashboardStatisticsController } from './admin-dashboard-statistics.controller';

@Module({
  imports: [AuthModule, CaslModule],
  providers: [DashboardService],
  controllers: [
    DashboardController,
    HelpRequestStatsController,
    AdminDashboardStatisticsController,
  ],
})
export class DashboardModule {}
