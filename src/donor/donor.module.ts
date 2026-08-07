import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DonorMobileController } from './donor-mobile.controller';
import { DonorController } from './donor.controller';
import { DonorService } from './donor.service';
import { PublicStatisticsController } from './public-statistics.controller';

@Module({
  imports: [AuthModule, PrismaModule, CaslModule],
  controllers: [
    DonorController,
    DonorMobileController,
    PublicStatisticsController,
  ],
  providers: [DonorService],
})
export class DonorModule {}
