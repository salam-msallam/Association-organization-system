import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SponsorshipFundController } from './sponsorship-fund.controller';
import { WalletController } from './wallet.controller';
import { QuickAidFundController } from './quick-aid-fund.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    PaymentsController,
    WalletController,
    SponsorshipFundController,
    QuickAidFundController,
  ],
  providers: [PaymentsService],
})
export class PaymentsModule {}
