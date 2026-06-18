import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeeModule } from './employee/employee.module';
import { TranslationInterceptor } from './interceptors/translation.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core'; 
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import * as path from 'path'; 
import { CaslModule } from './casl/casl.module';
import { RoleModule } from './role/role.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
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