import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { SponsorshipController } from './sponsorship.controller';
import { SponsorshipService } from './sponsorship.service';
import { AdminSponsorshipController } from './admin-sponsorship.controller';
import { SponsorshipFundService } from './sponsorship-fund.service';
import { AdminSponsorshipFundController } from './admin-sponsorship-fund.controller';

@Module({
  imports: [AuthModule, PrismaModule, CaslModule],
  controllers: [
    SponsorshipController,
    AdminSponsorshipController,
    AdminSponsorshipFundController,
  ],
  providers: [SponsorshipService, SponsorshipFundService],
})
export class SponsorshipModule {}
