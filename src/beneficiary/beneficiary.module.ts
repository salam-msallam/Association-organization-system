import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaslModule } from '../casl/casl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminBeneficiariesController } from './beneficiary.controller';
import { BeneficiaryService } from './beneficiary.service';

@Module({
  imports: [AuthModule, CaslModule, NotificationsModule],
  controllers: [AdminBeneficiariesController],
  providers: [BeneficiaryService],
})
export class BeneficiaryModule {}
