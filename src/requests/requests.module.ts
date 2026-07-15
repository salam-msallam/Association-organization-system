import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestAidService } from './requests.service';
import { HealthRequestController } from './controllers/health-request.controller';
import { FoodRequestController } from './controllers/food-request.controller';
import { HousingRequestController } from './controllers/housing-request.controller';
import { EducationRequestController } from './controllers/education-request.controller';
import { SmallProjectRequestController } from './controllers/small-project-request.controller';
import { RequestsController } from './controllers/request.controller';
import { AdminHelpRequestsController } from './controllers/admin-help-requests.controller';
import { CaslModule } from '../casl/casl.module';

@Module({
  imports: [PrismaModule, CaslModule],
  controllers: [
    HealthRequestController,
    FoodRequestController,
    HousingRequestController,
    EducationRequestController,
    SmallProjectRequestController,
    RequestsController,
    AdminHelpRequestsController,
  ],
  providers: [RequestAidService],
  exports: [RequestAidService],
})
export class RequestsModule {}
