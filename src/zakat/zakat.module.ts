import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DonorOnlyGuard } from '../guards/donor-only.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ZakatController } from './zakat.controller';
import { ZakatService } from './zakat.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ZakatController],
  providers: [ZakatService, DonorOnlyGuard],
})
export class ZakatModule {}
