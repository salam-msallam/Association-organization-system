import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path'; 

@Module({
  imports: 
  [PrismaModule,
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

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
