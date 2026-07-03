import { Module } from '@nestjs/common';
import { OrphanController } from './orphan.controller';
import { OrphanService } from './orphan.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [OrphanController],
  providers: [OrphanService],
})
export class OrphanModule {}