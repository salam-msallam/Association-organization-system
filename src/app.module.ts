import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeeModule } from './employee/employee.module';
import { TranslationInterceptor } from './interceptors/translation.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CaslModule } from './casl/casl.module';
import { RoleModule } from './role/role.module';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { AuthModule } from './auth/auth.module';
import * as path from 'path';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { OrphanModule } from './orphan/orphan.module';
import { RequestsModule } from './requests/requests.module';
import { BeneficiaryModule } from './beneficiary/beneficiary.module';
import { CategoryModule } from './category/category.module';
import { PaymentsModule } from './payments/payments.module';
import { ProfileModule } from './profile/profile.module';
import { SponsorshipModule } from './sponsorship/sponsorship.module';
import { DonorModule } from './donor/donor.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AnnualReportModule } from './annual-report/annual-report.module';
import { QuickAidFundModule } from './quick-aid-fund/quick-aid-fund.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    EmployeeModule,
    CaslModule,
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: path.join(__dirname, '..', 'i18n'),
        watch: true,
      },
      resolvers: [new AcceptLanguageResolver()],
    }),
    RoleModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    OrphanModule,
    RequestsModule,
    BeneficiaryModule,
    CategoryModule,
    PaymentsModule,
    ProfileModule,
    SponsorshipModule,
    DonorModule,
    AnnualReportModule,
    QuickAidFundModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TranslationInterceptor,
    },
  ],
})
export class AppModule {}
