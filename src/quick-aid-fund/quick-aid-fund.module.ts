import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminQuickAidFundController } from './admin-quick-aid-fund.controller';
import { QuickAidFundService } from './quick-aid-fund.service';

@Module({
  imports: [AuthModule, CaslModule, PrismaModule],
  controllers: [AdminQuickAidFundController],
  providers: [QuickAidFundService],
})
export class QuickAidFundModule {}
