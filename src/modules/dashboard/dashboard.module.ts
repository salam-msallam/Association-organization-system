import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { HelpRequestStatsController } from './help-request-stats.controller';

@Module({
  providers: [DashboardService],
  controllers: [DashboardController, HelpRequestStatsController],
})
export class DashboardModule {}
