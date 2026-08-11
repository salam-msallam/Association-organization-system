import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnnualReportController } from './annual-report.controller';
import { AnnualReportService } from './annual-report.service';
import { DonorAnnualReportController } from './donor-annual-report.controller';

@Module({
  imports: [AuthModule, CaslModule, PrismaModule],
  controllers: [AnnualReportController, DonorAnnualReportController],
  providers: [AnnualReportService],
})
export class AnnualReportModule {}
