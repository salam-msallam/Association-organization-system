import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PaymentsController, WalletController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
