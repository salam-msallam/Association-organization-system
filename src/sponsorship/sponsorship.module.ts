import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CaslModule } from '../casl/casl.module';
import { SponsorshipController } from './sponsorship.controller';
import { SponsorshipService } from './sponsorship.service';
import { AdminSponsorshipController } from './admin-sponsorship.controller';
import { SponsorshipFundService } from './sponsorship-fund.service';

@Module({
  imports: [AuthModule, PrismaModule, CaslModule],
  controllers: [SponsorshipController, AdminSponsorshipController],
  providers: [SponsorshipService, SponsorshipFundService],
})
export class SponsorshipModule {}
