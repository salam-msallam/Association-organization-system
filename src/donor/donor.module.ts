import { Module } from '@nestjs/common';
import { CaslModule } from '../casl/casl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DonorController } from './donor.controller';
import { DonorService } from './donor.service';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [DonorController],
  providers: [DonorService],
})
export class DonorModule {}
