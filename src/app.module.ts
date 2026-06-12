import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { AuthModule } from './auth/auth.module';
import * as path from 'path'; 
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: 
  [PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'ar', 
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'), 
        watch: true,
      },
      resolvers: [
        
        new AcceptLanguageResolver(), 
         
      ],
    }),
    AuthModule,
    UsersModule,
    DashboardModule,
    

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
