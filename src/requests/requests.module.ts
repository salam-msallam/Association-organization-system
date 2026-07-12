import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RequestAidService } from './requests.service';
import { HealthRequestController } from './controllers/health-request.controller';
import { FoodRequestController } from './controllers/food-request.controller';
import { HousingRequestController } from './controllers/housing-request.controller';
import { EducationRequestController } from './controllers/education-request.controller';
import { SmallProjectRequestController } from './controllers/small-project-request.controller';
import { RequestsController } from './controllers/request.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    HealthRequestController,
    FoodRequestController,
    HousingRequestController,
    EducationRequestController,
    SmallProjectRequestController,
    RequestsController,
  ],
  providers: [RequestAidService],
  exports: [RequestAidService],
})
export class RequestsModule {}
