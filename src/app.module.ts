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

@Module({
  imports: 
  [PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmployeeModule,
    CaslModule,
    I18nModule.forRoot({
      fallbackLanguage: 'ar', 
      loaderOptions: {
        path: path.join(__dirname, '..', 'i18n'), 
        watch: true,
      },
      resolvers: [
        new AcceptLanguageResolver(), 
      ],
    }),
    RoleModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    OrphanModule,
    RequestsModule,
    

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
