import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { CaslModule } from '../casl/casl.module'; 
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:[CaslModule,PrismaModule],
  providers: [RoleService],
  controllers: [RoleController]
})
export class RoleModule {}
