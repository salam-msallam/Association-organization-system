import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DonorMobileController } from './donor-mobile.controller';
import { DonorController } from './donor.controller';
import { DonorService } from './donor.service';

@Module({
  imports: [AuthModule, PrismaModule, CaslModule],
  controllers: [DonorController, DonorMobileController],
  providers: [DonorService],
})
export class DonorModule {}
